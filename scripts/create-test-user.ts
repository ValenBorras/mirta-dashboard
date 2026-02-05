// Script para crear un usuario de prueba en Supabase
// Ejecutar con: npx ts-node scripts/create-test-user.ts
// O agregar los datos directamente en Supabase

import bcrypt from 'bcryptjs'

async function createTestUser() {
  const password = 'mirta2024' // Cambiar por una contraseña segura en producción
  const hashedPassword = await bcrypt.hash(password, 12)
  
  console.log('=== Usuario de Prueba para MIRTA ===\n')
  console.log('Email: admin@mirta.gob.ar')
  console.log('Password: mirta2024')
  console.log('Password Hash:', hashedPassword)
  console.log('\n=== SQL para insertar en Supabase ===\n')
  console.log(`
INSERT INTO usuario (nombre, email, password_hash, cargo, provincia, activo)
VALUES (
  'Administrador MIRTA',
  'admin@mirta.gob.ar',
  '${hashedPassword}',
  'Administrador',
  'Buenos Aires',
  true
);
  `)
}

createTestUser()
