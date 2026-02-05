import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * WhatsApp Message Webhook - Entry Point
 * 
 * This endpoint receives message data from n8n and triggers the multi-agent flow.
 * 
 * Flow:
 * 1. n8n sends message data
 * 2. This endpoint saves the message to DB
 * 3. Triggers internal processing (AI agents, operators, etc.)
 * 4. AI responses are handled via OpenAI Response API within Next.js
 */

interface WhatsAppMessage {
  user_phone: string;
  conversation_id: string;
  timestamp: string;
  sender_type: 'USER' | 'AI' | 'OPERATOR';
  message_text: string;
  message_id: string;
}

/**
 * POST handler - Webhook entry point from n8n
 */
export async function POST(request: NextRequest) {
  try {
    const body: WhatsAppMessage = await request.json();

    // Validate required fields
    if (!body.user_phone || !body.conversation_id || !body.message_text || !body.sender_type || !body.message_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields' 
        },
        { status: 400 }
      );
    }

    const { user_phone, conversation_id, sender_type, message_text } = body;

    console.log(`📨 Received message from ${user_phone}: "${message_text}"`);

    // Check if conversation exists
    const { data: existingConversation, error: fetchError } = await supabaseAdmin
      .from('conversation')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching conversation:', fetchError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Database error',
          conversation_id
        },
        { status: 500 }
      );
    }

    // Create conversation if it doesn't exist
    if (!existingConversation) {
      console.log(`📝 Creating new conversation: ${conversation_id}`);
      
      // Get the Orchestrator agent
      const { data: orchestratorAgent, error: agentError } = await supabaseAdmin
        .from('ai_agent')
        .select('id, prompt')
        .eq('name', 'Orchestrator')
        .single();

      if (agentError || !orchestratorAgent) {
        console.error('❌ Orchestrator agent not found:', agentError);
        return NextResponse.json(
          { 
            success: false,
            error: 'Orchestrator agent not found'
          },
          { status: 500 }
        );
      }

      // Create OpenAI conversation
      const openaiConversationId = await createOpenAIConversation();
      
      if (!openaiConversationId) {
        console.error('❌ Failed to create OpenAI conversation');
        return NextResponse.json(
          { 
            success: false,
            error: 'Failed to create OpenAI conversation'
          },
          { status: 500 }
        );
      }

      // Create conversation in Supabase with Orchestrator assigned
      const { error: createError } = await supabaseAdmin
        .from('conversation')
        .insert({
          id: conversation_id,
          user_phone: user_phone,
          area_id: null,
          active_participant_type: 'AI_AGENT',
          active_participant_id: orchestratorAgent.id,
          status: 'open',
          openai_conversation_id: openaiConversationId,
        });

      if (createError) {
        console.error('❌ Error creating conversation:', createError);
        return NextResponse.json(
          { 
            success: false,
            error: 'Failed to create conversation',
            conversation_id
          },
          { status: 500 }
        );
      }

      console.log(`✅ Conversation created with Orchestrator agent`);
    }

    // Save the message to database
    const { data: savedMessage, error: messageError } = await supabaseAdmin
      .from('message')
      .insert({
        conversation_id,
        sender_type,
        sender_id: null, // Will be populated later when we identify the agent/operator
        text: message_text,
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Error saving message:', messageError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to save message',
          conversation_id
        },
        { status: 500 }
      );
    }

    console.log(`✅ Message saved: ${savedMessage.id}`);

    // Get updated conversation (includes openai_conversation_id and active agent)
    const { data: conversation } = await supabaseAdmin
      .from('conversation')
      .select('*')
      .eq('id', conversation_id)
      .single();

    // Process message if it's from USER
    if (sender_type === 'USER' && conversation) {
      // Verify that openai_conversation_id exists, if not create one
      let openaiConvId = conversation.openai_conversation_id;
      
      if (!openaiConvId) {
        console.log('⚠️ No OpenAI conversation ID found, creating new one...');
        openaiConvId = await createOpenAIConversation();
        
        if (openaiConvId) {
          // Update conversation with new OpenAI ID
          await supabaseAdmin
            .from('conversation')
            .update({ openai_conversation_id: openaiConvId })
            .eq('id', conversation_id);
          
          conversation.openai_conversation_id = openaiConvId;
          console.log('✅ OpenAI conversation created and saved');
        } else {
          console.error('❌ Failed to create OpenAI conversation');
          return NextResponse.json(
            { 
              success: false,
              error: 'Failed to create OpenAI conversation'
            },
            { status: 500 }
          );
        }
      }

      await processUserMessage(conversation, message_text);
    }

    return NextResponse.json(
      { 
        success: true,
        data: {
          conversation_id,
          message_id: savedMessage.id,
          timestamp: savedMessage.timestamp
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// ============================================
// OpenAI Integration Functions
// ============================================

/**
 * Create a new conversation in OpenAI
 * Returns the OpenAI conversation ID
 */
async function createOpenAIConversation(): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        metadata: { source: 'whatsapp' }
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error creating OpenAI conversation:', error);
    return null;
  }
}

interface FunctionCall {
  name: string;
  arguments?: string | Record<string, unknown>;
  id?: string;
  call_id?: string;
}

interface ToolResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * Execute an HTTP tool call
 */
async function executeHttpTool(functionCall: FunctionCall, _conversationId: string): Promise<ToolResult> {
  try {
    // Extract function name and arguments from the call
    const toolName = functionCall.name;
    const toolArgs = functionCall.arguments || {};
    
    // Parse arguments if they're a string (OpenAI returns them as JSON string)
    const parsedArgs = typeof toolArgs === 'string' ? JSON.parse(toolArgs) : toolArgs;
    
    console.log(`🔧 Executing HTTP tool: ${toolName}`, parsedArgs);
    
    // Map function names to endpoints
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://multi-agent-dashboard-hospital-san.vercel.app';
    const endpoints: Record<string, string> = {
      'list_available_agents': `${baseUrl}/api/tools/list-available-agents`,
      'transfer_conversation': `${baseUrl}/api/tools/transfer-conversation`,
      'request_human_assistance': `${baseUrl}/api/tools/request-human-assistance`,
    };
    
    const endpoint = endpoints[toolName];
    if (!endpoint) {
      console.error(`❌ Unknown tool: ${toolName}`);
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }
    
    // Call the HTTP endpoint
    const toolResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsedArgs),
    });
    
    if (!toolResponse.ok) {
      const errorText = await toolResponse.text();
      console.error(`❌ HTTP tool call failed for ${toolName}:`, errorText);
      return {
        success: false,
        error: `Tool execution failed: ${errorText}`,
      };
    }
    
    const result = await toolResponse.json();
    console.log(`✅ HTTP tool executed successfully: ${toolName}`);
    
    return result;
  } catch (error) {
    console.error('❌ Error executing HTTP tool:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Call an AI agent for a simple greeting (no tools)
 * Returns the agent's response text
 */
async function callAgentForGreeting(
  promptId: string,
  message: string,
  openaiConversationId: string,
  conversationId: string,
  specificPrompt?: string | null
): Promise<string | null> {
  try {
    console.log(`👋 Calling agent for greeting with prompt: ${promptId}`);

    // Build the request body (without tools)
    const requestBody: {
      conversation: string;
      input: string;
      prompt: {
        id: string;
        variables: {
          conversation_id: string;
        };
      };
      store: boolean;
      instructions?: string;
    } = {
      conversation: openaiConversationId,
      input: message,
      prompt: {
        id: promptId,
        variables: {
          conversation_id: conversationId
        }
      },
      store: true,
    };

    // Add specific_prompt (instructions) if provided
    if (specificPrompt) {
      requestBody.instructions = specificPrompt;
    }

    // Create response using OpenAI Response API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Response API error (greeting):', errorText);
      return null;
    }

    const data = await response.json();
    
    // Extract text from response output
    if (data.output && data.output.length > 0) {
      const messageItem = data.output.find((item: { type: string }) => item.type === 'message');
      
      if (messageItem && 'content' in messageItem && Array.isArray(messageItem.content) && messageItem.content.length > 0) {
        const textContent = messageItem.content.find((c: { type: string }) => c.type === 'output_text');
        if (textContent && 'text' in textContent && typeof textContent.text === 'string') {
          return textContent.text;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error calling agent for greeting:', error);
    return null;
  }
}

/**
 * Call an AI agent with a message
 * Returns an object with the agent's response text and transfer information
 */
async function callAgent(
  promptId: string,
  message: string,
  openaiConversationId: string,
  conversationId: string,
  specificPrompt?: string | null,
  vectorStore?: string | null
): Promise<{ response: string | null; transferredToAgentId: string | null }> {
  try {
    console.log(`🤖 Calling agent with prompt: ${promptId}`);

    // Build the request body
    interface RequestBody {
      conversation: string;
      input: string;
      prompt: {
        id: string;
        variables: {
          conversation_id: string;
        };
      };
      store: boolean;
      tools: Array<{
        type: string;
        name?: string;
        description?: string;
        parameters?: Record<string, unknown>;
        strict?: boolean;
        file_search?: {
          vector_store_ids: string[];
        };
      }>;
      instructions?: string;
    }

    const requestBody: RequestBody = {
      conversation: openaiConversationId,
      input: message,
      prompt: {
        id: promptId,
        variables: {
          conversation_id: conversationId
        }
      },
      store: true, // Store conversation state in OpenAI
      tools: [], // Initialize tools array
    };

    // Add specific_prompt (instructions) if provided
    if (specificPrompt) {
      requestBody.instructions = specificPrompt;
    }

    // Add function tools (always available)
    requestBody.tools.push(
      {
        type: 'function',
        name: 'list_available_agents',
        description: 'Lists all available AI agents with their areas. Use this to discover which agents are available before transferring a conversation.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        strict: false,
      },
      {
        type: 'function',
        name: 'transfer_conversation',
        description: 'Transfer an ongoing conversation to another AI agent. Use this when the conversation needs to be handled by a specialized agent from a different area.',
        parameters: {
          type: 'object',
          properties: {
            conversationId: {
              type: 'string',
              description: 'The ID of the conversation to transfer (use the conversation_id variable)',
            },
            targetAgentId: {
              type: 'string',
              description: 'The UUID of the AI agent to transfer the conversation to (get this from list_available_agents)',
            },
            reason: {
              type: 'string',
              description: 'Optional reason for the transfer',
            },
          },
          required: ['conversationId', 'targetAgentId'],
        },
        strict: false,
      },
      {
        type: 'function',
        name: 'request_human_assistance',
        description: 'Request human operator assistance by changing the conversation status to waiting. This will send the conversation to the area operator\'s dashboard for human intervention.',
        parameters: {
          type: 'object',
          properties: {
            conversationId: {
              type: 'string',
              description: 'The ID of the conversation (use the conversation_id variable)',
            },
            reason: {
              type: 'string',
              description: 'Optional reason for requesting human assistance',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Priority level of the request',
            },
          },
          required: ['conversationId'],
        },
        strict: false,
      }
    );

    // Add file_search tool with vector_store if provided
    if (vectorStore) {
      requestBody.tools.push({
        type: 'file_search',
        file_search: {
          vector_store_ids: [vectorStore]
        }
      });
    }

    // Log request for debugging
    console.log('📤 Request to OpenAI:', JSON.stringify({
      ...requestBody,
      tools: requestBody.tools?.length > 0 ? `${requestBody.tools.length} tools configured` : 'No tools',
    }, null, 2));

    // Create response using OpenAI Response API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Response API error:', errorText);
      return { response: null, transferredToAgentId: null };
    }

    let currentData = await response.json();
    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    let transferredToAgentId: string | null = null; // Track if conversation was transferred
    
    // Loop to handle multiple rounds of function calls
    while (iteration < maxIterations) {
      iteration++;
      
      // Check if there are function calls that need to be executed
      const functionCalls = currentData.output?.filter((item: { type: string }) => item.type === 'function_call') as FunctionCall[] | undefined;
      
      if (!functionCalls || functionCalls.length === 0) {
        // No more function calls, break the loop
        break;
      }
      
      console.log(`🔧 Round ${iteration}: Found ${functionCalls.length} function call(s), executing...`);
      console.log('Function calls:', JSON.stringify(functionCalls, null, 2));
      
      // Execute each function call and collect results
      const toolResults: Array<{
        type: string;
        call_id?: string;
        output: string;
      }> = [];
      
      for (const functionCall of functionCalls) {
        const result = await executeHttpTool(functionCall, conversationId);
        
        console.log(`📋 Function call details:`, {
          id: functionCall.id,
          call_id: functionCall.call_id,
          name: functionCall.name
        });
        
        toolResults.push({
          type: 'function_call_output',
          call_id: functionCall.call_id,
          output: JSON.stringify(result),
        });
        
        // If transfer_conversation was successful, save the target agent ID
        if (functionCall.name === 'transfer_conversation' && result.success && 'targetAgentId' in result && typeof result.targetAgentId === 'string') {
          console.log('✅ Conversation transferred, will send greeting after loop completes');
          transferredToAgentId = result.targetAgentId;
        }
      }
      
      console.log('📤 Sending tool results back to OpenAI...');
      console.log('Tool results:', JSON.stringify(toolResults, null, 2));
      
      // Continue the conversation with ONLY the tool results
      const followUpResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          conversation: openaiConversationId,
          input: toolResults,
          prompt: {
            id: promptId,
            variables: {
              conversation_id: conversationId
            }
          },
          tools: requestBody.tools,
          store: true,
        }),
      });
      
      if (!followUpResponse.ok) {
        console.error('❌ Follow-up request failed:', await followUpResponse.text());
        break;
      }
      
      currentData = await followUpResponse.json();
      console.log(`✅ Received response from round ${iteration}`);
    }
    
    if (iteration >= maxIterations) {
      console.error('⚠️ Max iterations reached, stopping function call loop');
    }
    
    // Extract text from final response output
    // Note: output array may contain reasoning items and message items
    // We need to find the message item with type "message"
    let responseText: string | null = null;
    
    if (currentData.output && currentData.output.length > 0) {
      const messageItem = currentData.output.find((item: { type: string }) => item.type === 'message');
      
      if (messageItem && 'content' in messageItem && Array.isArray(messageItem.content) && messageItem.content.length > 0) {
        const textContent = messageItem.content.find((c: { type: string }) => c.type === 'output_text');
        if (textContent && 'text' in textContent && typeof textContent.text === 'string') {
          responseText = textContent.text;
        }
      }
    }

    // Return both the response and transfer information
    return {
      response: responseText,
      transferredToAgentId: transferredToAgentId
    };
  } catch (error) {
    console.error('Error calling agent:', error);
    return { response: null, transferredToAgentId: null };
  }
}

/**
 * Reset a conversation back to the Orchestrator agent
 */
async function resetConversation(conversation: { id: string; user_phone: string }) {
  try {
    console.log('🔄 Resetting conversation:', conversation.id);

    // 1. Get the Orchestrator agent
    const { data: orchestratorAgent, error: agentError } = await supabaseAdmin
      .from('ai_agent')
      .select('id, name')
      .eq('name', 'Orchestrator')
      .single();

    if (agentError || !orchestratorAgent) {
      console.error('❌ Orchestrator agent not found:', agentError);
      return;
    }

    console.log('✅ Found Orchestrator agent:', orchestratorAgent.id);

    // 2. Create a new OpenAI conversation (fresh start)
    const newOpenaiConversationId = await createOpenAIConversation();
    
    if (!newOpenaiConversationId) {
      console.error('❌ Failed to create new OpenAI conversation');
      return;
    }

    console.log('✅ Created new OpenAI conversation:', newOpenaiConversationId);

    // 3. Update conversation in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('conversation')
      .update({
        active_participant_id: orchestratorAgent.id,
        active_participant_type: 'AI_AGENT',
        area_id: null,
        status: 'open',
        openai_conversation_id: newOpenaiConversationId,
      })
      .eq('id', conversation.id);

    if (updateError) {
      console.error('❌ Error updating conversation:', updateError);
      return;
    }

    console.log('✅ Conversation reset in database');

    // 4. Send confirmation message to user
    await sendWhatsAppMessage(conversation.user_phone, 'reset completado');
    console.log('✅ Reset confirmation sent to user');

  } catch (error) {
    console.error('❌ Error resetting conversation:', error);
  }
}

/**
 * Process a user message through the active AI agent
 */
async function processUserMessage(conversation: {
  id: string;
  user_phone: string;
  active_participant_id: string | null;
  openai_conversation_id: string;
}, messageText: string) {
  try {
    console.log('👤 Processing user message through agent...');

    // Check for special commands
    if (messageText.toLowerCase() === '!reset') {
      console.log('🔄 Reset command received - resetting conversation...');
      await resetConversation(conversation);
      return;
    }

    // Get the active agent with all fields
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('ai_agent')
      .select('id, name, prompt, specific_prompt, vector_store')
      .eq('id', conversation.active_participant_id)
      .single();

    if (agentError || !agent) {
      console.error('❌ No active agent found:', agentError);
      return;
    }

    console.log(`✅ Active agent: ${agent.name}`);

    // Call the agent with the user's message, including optional fields
    const agentResult = await callAgent(
      agent.prompt,
      messageText,
      conversation.openai_conversation_id,
      conversation.id, // conversation_id for prompt variables
      agent.specific_prompt, // Pass specific_prompt if exists
      agent.vector_store // Pass vector_store if exists
    );

    if (!agentResult.response) {
      console.error('❌ Agent did not return a response');
      return;
    }

    console.log(`✅ Agent response received: ${agentResult.response.substring(0, 50)}...`);

    // Save agent's response to database
    const { error: saveError } = await supabaseAdmin
      .from('message')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'AI',
        sender_id: agent.id,
        text: agentResult.response,
      });

    if (saveError) {
      console.error('❌ Error saving agent response:', saveError);
      return;
    }

    console.log('✅ Agent response saved to database');

    // Send response back to WhatsApp via n8n webhook (ORCHESTRATOR MESSAGE FIRST)
    await sendWhatsAppMessage(conversation.user_phone, agentResult.response);
    console.log('📤 Orchestrator message sent to WhatsApp');

    // If conversation was transferred, send new agent greeting AFTER orchestrator message
    if (agentResult.transferredToAgentId) {
      console.log('👋 Conversation was transferred, sending new agent greeting...');
      await sendNewAgentGreeting(agentResult.transferredToAgentId, conversation);
    }

  } catch (error) {
    console.error('❌ Error in processUserMessage:', error);
  }
}

/**
 * Send greeting message from the new agent after a transfer
 */
async function sendNewAgentGreeting(transferredToAgentId: string, conversation: {
  id: string;
  user_phone: string;
  openai_conversation_id: string;
}) {
  try {
    // Get the new agent details
    const { data: newAgent } = await supabaseAdmin
      .from('ai_agent')
      .select('id, name, prompt, specific_prompt, vector_store, area_id')
      .eq('id', transferredToAgentId)
      .single();
    
    if (!newAgent) {
      console.error('❌ New agent not found:', transferredToAgentId);
      return;
    }

    console.log(`✅ New agent: ${newAgent.name}`);
    
    // Get area name if available
    let areaName = 'nuestro equipo';
    if (newAgent.area_id) {
      const { data: area } = await supabaseAdmin
        .from('area')
        .select('name')
        .eq('id', newAgent.area_id)
        .single();
      if (area) {
        areaName = area.name;
      }
    }
    
    // Get recent conversation context (last 5 user messages)
    const { data: recentMessages } = await supabaseAdmin
      .from('message')
      .select('text, sender_type, timestamp')
      .eq('conversation_id', conversation.id)
      .order('timestamp', { ascending: false })
      .limit(10); // Get last 10 messages to filter user messages
    
    // Filter and format user messages (last 5)
    const userMessages = recentMessages
      ?.filter(msg => msg.sender_type === 'USER')
      .slice(0, 5)
      .reverse() || []; // Reverse to get chronological order
    
    // Build context string
    let contextString = '';
    if (userMessages.length > 0) {
      contextString = '\n\nContexto de la conversación previa:\n';
      userMessages.forEach((msg) => {
        contextString += `- ${msg.text}\n`;
      });
      contextString += '\nEl usuario necesita ayuda con lo mencionado arriba.';
    }
    
    // Build the prompt with context
    const promptWithContext = `INSTRUCCIÓN INTERNA: Preséntate brevemente como el asistente del área de ${areaName}. Luego, basándote en el contexto de la conversación previa, responde directamente la consulta del usuario de manera útil y profesional.${contextString}`;
    
    console.log('📋 Context retrieved:', userMessages.length, 'user messages');
    
    // Call the new agent with context (without tools to avoid loops)
    const greetingMessage = await callAgentForGreeting(
      newAgent.prompt,
      promptWithContext,
      conversation.openai_conversation_id,
      conversation.id,
      newAgent.specific_prompt
    );
    
    if (greetingMessage) {
      console.log('📤 Sending new agent response with context to user...');
      
      // Save the greeting message to database
      await supabaseAdmin
        .from('message')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'AI',
          sender_id: newAgent.id,
          text: greetingMessage,
        });
      
      // Send greeting to WhatsApp (AFTER orchestrator message)
      await sendWhatsAppMessage(conversation.user_phone, greetingMessage);
      console.log('✅ New agent response sent');
    }
  } catch (error) {
    console.error('❌ Error sending new agent greeting:', error);
  }
}

/**
 * Send a message to WhatsApp via n8n webhook
 */
async function sendWhatsAppMessage(userPhone: string, messageText: string) {
  try {
    const response = await fetch('https://n8n.southamerica-east1-a.gcp.pathfinding.com.ar/webhook/send-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'cnRO8gxiwnnLShIe2hO1ROJvv7b8GguU',
      },
      body: JSON.stringify({
        to: userPhone,
        type: 'text',
        text: messageText,
      }),
    });

    if (!response.ok) {
      console.error('❌ Error sending WhatsApp message:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error calling n8n webhook:', error);
    return false;
  }
}

