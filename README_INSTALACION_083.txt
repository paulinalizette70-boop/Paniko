PANIKO 0.8.3 · CORRECCION DE MASA MADRE Y LECHE

1. Deten Paniko con Ctrl+C.
2. Abre PowerShell dentro de esta carpeta Paniko-0.8.3.
3. Ejecuta:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_PANIKO_083.ps1 -Destino "D:\Paniko-main\Paniko-main"
4. Confirma escribiendo ACTUALIZAR.
5. El instalador reemplaza solo codigo y ejecuta npm.cmd test.
6. Inicia con: cd "D:\Paniko-main\Paniko-main"; node --env-file=.env server.js
7. Abre http://127.0.0.1:3000 y presiona Ctrl+F5.

Requiere Paniko 0.8.2 como version de origen.
No crea tablas nuevas ni toca la base MySQL al instalar.
No borra ni reemplaza .env, private/, data/, node_modules/ ni recetas.
No modifiques el inventario real para probar; usa primero inventario ficticio o un conteo fisico verificado.

Importante:
- Masa madre ya vinculada: Mi masa madre > Corregir existencias (conteo fisico).
- Masa madre nueva: Conectar con inventario > elegir usar Inventario o sincronizar el peso existente de la bitacora.
- Brioche con leche: se acepta g/kg/ml/l para leche liquida, conversion aproximada 1ml=1.03g.
- Si la receta usa leche en polvo/condensada/evaporada, mantener misma magnitud o realizar conversion especifica comprobada.
