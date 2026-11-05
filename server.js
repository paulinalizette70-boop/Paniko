'use strict';
const {createApp} = require('./src/app');
const port = Number(process.env.PORT || 3000);
createApp({dataFile: process.env.DATA_FILE}).listen(port, () => {
  console.log(`Paniko disponible en http://localhost:${port}`);
});
