-- Normaliza la cédula de los clientes: solo dígitos ("1.080.044.910" -> "1080044910").
-- Desde ahora la app guarda y compara la cédula así, en la factura y en la pantalla Clientes.
--
-- Si al normalizar una cédula quedara igual a la de OTRO cliente del mismo local, esa fila NO se
-- cambia (no se fusionan clientes automáticamente): queda para revisarla a mano. Para verlas:
--   select local_id, regexp_replace(identificacion, '\D', '', 'g') as cedula, array_agg(identificacion)
--   from clientes group by 1, 2 having count(*) > 1;
-- El índice único clientes_local_ident_uq (local_id, identificacion) se mantiene.
UPDATE "clientes" AS c
SET "identificacion" = regexp_replace(c."identificacion", '\D', '', 'g'),
    "actualizado_en" = now()
WHERE c."identificacion" ~ '\D'
  AND NOT EXISTS (
    SELECT 1 FROM "clientes" AS o
    WHERE o."local_id" = c."local_id"
      AND o."id" <> c."id"
      AND regexp_replace(o."identificacion", '\D', '', 'g') = regexp_replace(c."identificacion", '\D', '', 'g')
  );
