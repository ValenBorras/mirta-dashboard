import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * HTTP Tool: List Available Agents
 * 
 * Lists all available AI agents with their areas.
 * Use this to discover which agents are available before transferring a conversation.
 */
export async function POST(_request: NextRequest) {
  try {
    console.log('🔧 HTTP Tool Called: list_available_agents');

    // Query all AI agents with their area information
    const { data: agents, error: fetchError } = await supabaseAdmin
      .from('ai_agent')
      .select(`
        id,
        name,
        prompt,
        area:area_id (
          id,
          name
        )
      `)
      .order('name');

    if (fetchError) {
      console.error('❌ Error fetching agents:', fetchError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch agents: ${fetchError.message}`,
      }, { status: 500 });
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No agents found',
        agents: [],
        totalAgents: 0,
      });
    }

    // Format the response
    const formattedAgents = agents.map((agent) => {
      // Handle area as array or single object
      const area = Array.isArray(agent.area) ? agent.area[0] : agent.area;
      return {
        agentId: agent.id,
        agentName: agent.name,
        areaId: area?.id || null,
        areaName: area?.name || 'Sin área asignada',
      };
    });

    console.log(`✅ Found ${formattedAgents.length} agents`);

    return NextResponse.json({
      success: true,
      message: `Found ${formattedAgents.length} active agent(s)`,
      totalAgents: formattedAgents.length,
      agents: formattedAgents,
    });

  } catch (error) {
    console.error('❌ Error in list_available_agents:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }, { status: 500 });
  }
}

