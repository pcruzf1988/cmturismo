# CM Tool — Community Manager con IA

## Instalación

1. Instalá las dependencias:
```bash
npm install
```

2. Configurá tu API key de Anthropic:
```bash
# En macOS/Linux:
export ANTHROPIC_API_KEY="tu-api-key-aqui"

# O creá un archivo .env (necesitás instalar dotenv):
ANTHROPIC_API_KEY=tu-api-key-aqui
```

3. Iniciá el servidor:
```bash
npm start
```

4. Abrí en el navegador:
```
http://localhost:3000
```

## Estructura del proyecto

```
cm-tool/
├── server.js          # Backend Express + API de Anthropic
├── public/
│   ├── index.html     # App principal
│   ├── css/
│   │   └── styles.css # Estilos
│   └── js/
│       └── app.js     # Lógica del frontend
├── data/
│   └── clients.json   # Base de datos local (se crea automáticamente)
└── package.json
```

## Funcionalidades actuales (Fase 1)

- ✅ Alta de clientes con entrevista guiada de 6 bloques
- ✅ Generación de perfil consolidado con IA (Claude)
- ✅ Dashboard con estadísticas
- ✅ Vista de detalle del cliente
- ✅ Generación de plan mensual con copy listo para publicar
- ✅ Copiar copy al portapapeles

## Próximas funcionalidades (Fase 2 y 3)

- ⏳ Exportar plan mensual a PDF (para el cliente)
- ⏳ Guía de contenido simplificada para los emprendedores
- ⏳ Informe de rendimiento mensual
- ⏳ Conexión con API de Meta (Instagram y Facebook Insights)
