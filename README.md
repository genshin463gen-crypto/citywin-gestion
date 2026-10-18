# CityWin Gestión

Panel de operación de CityWin: contenido del día por canal, calendario de juegos, códigos especiales con listas y registro de códigos promocionales.

## Puesta en marcha
1. En Supabase → SQL Editor, correr `supabase/schema.sql` y después `seed-1.sql`, `seed-2.sql` y `seed-3.sql` (datos del Excel).
2. Completar `config.js` con la Project URL y la anon key.
3. Vercel → Add New Project → importar este repo (sin build, es un sitio estático).
