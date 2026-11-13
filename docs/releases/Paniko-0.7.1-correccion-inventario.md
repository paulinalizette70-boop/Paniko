# Paniko 0.7.1 — Corrección de compatibilidad de inventario

## Síntoma confirmado
Tras instalar el paquete 0.7.1 sobre `D:\Paniko-main\Paniko-main` (base local 0.6.0), tres tests de inventario fallaron:
- `INV-01`: `TypeError: stockExit is not a function`.
- `INV-02`: `TypeError: stockAdjustment is not a function`.
- `INV-03`: estado HTTP 500 al intentar un ajuste que debía dar HTTP 200.
