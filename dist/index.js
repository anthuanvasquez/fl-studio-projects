"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardarArchivoEnBaseDatos = exports.obtenerNombreBase = exports.obtenerVersion = exports.leerArchivos = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const commander_1 = require("commander");
const mysql = __importStar(require("mysql2"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// Configuración de conexión a la base de datos MySQL
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT)
});
// Parsear los argumentos de la línea de comandos
commander_1.program.option('-d, --dir <directorio>', 'Directorio raíz');
commander_1.program.parse(process.argv);
// Obtener el directorio raíz del flag --dir o utilizar uno por defecto
const directorioRaiz = commander_1.program.opts().dir;
if (!directorioRaiz) {
    throw new Error('Debes especificar el directo raiz: --dir <directorio>.');
}
/**
 * Función para recorrer los archivos y carpetas de forma recursiva.
 *
 * @param   {string}  dir  [dir description]
 * @return  {void}         [return description]
 */
function leerArchivos(dir) {
    const archivos = fs.readdirSync(dir);
    const archivosConVersiones = {};
    for (const archivo of archivos) {
        const rutaCompleta = path.join(dir, archivo);
        const estadisticas = fs.statSync(rutaCompleta);
        if (estadisticas.isDirectory()) {
            leerArchivos(rutaCompleta); // Llamada recursiva para leer subdirectorios
        }
        else {
            const nombreArchivo = path.basename(archivo, path.extname(archivo));
            const version = obtenerVersion(nombreArchivo);
            if (version > 0) {
                const nombreBase = obtenerNombreBase(nombreArchivo);
                if (!archivosConVersiones[nombreBase] ||
                    version > archivosConVersiones[nombreBase].version) {
                    archivosConVersiones[nombreBase] = {
                        ruta: rutaCompleta,
                        nombre: nombreArchivo,
                        version: version,
                    };
                }
            }
            else {
                guardarArchivoEnBaseDatos(rutaCompleta, nombreArchivo, 0);
            }
        }
    }
    for (const nombreArchivo in archivosConVersiones) {
        const archivo = archivosConVersiones[nombreArchivo];
        guardarArchivoEnBaseDatos(archivo.ruta, archivo.nombre, archivo.version);
    }
}
exports.leerArchivos = leerArchivos;
// Función para obtener el número de versión del archivo
function obtenerVersion(nombreArchivo) {
    const versionMatch = nombreArchivo.match(/_(\d+)\b/);
    if (versionMatch) {
        return parseInt(versionMatch[1]);
    }
    return 0;
}
exports.obtenerVersion = obtenerVersion;
// Función para obtener el nombre base del archivo sin la versión
function obtenerNombreBase(nombreArchivo) {
    return nombreArchivo.replace(/_\d+\b/, '');
}
exports.obtenerNombreBase = obtenerNombreBase;
// Función para guardar el archivo en la base de datos
function guardarArchivoEnBaseDatos(rutaArchivo, nombreArchivo, version) {
    const rutaRelativa = path.relative(directorioRaiz, rutaArchivo);
    const consultaExistencia = 'SELECT id FROM projects WHERE ruta = ?';
    connection.query(consultaExistencia, [rutaRelativa], (err, result) => {
        if (err) {
            console.error('Error al verificar la existencia del archivo en la base de datos:', err);
        }
        else if (result.length > 0) {
            // El archivo ya existe en la base de datos, realizar la actualización
            const idArchivo = result[0].id;
            const consultaActualizacion = 'UPDATE projects SET nombre = ?, version = ? WHERE id = ?';
            connection.query(consultaActualizacion, [nombreArchivo, version, idArchivo], (err) => {
                if (err) {
                    console.error('Error al actualizar el archivo en la base de datos:', err);
                }
                else {
                    console.log(`Archivo "${nombreArchivo}" (versión ${version}) actualizado en la base de datos.`);
                }
            });
        }
        else {
            // El archivo no existe en la base de datos, realizar la inserción
            const consultaInsercion = 'INSERT INTO projects (ruta, nombre, version) VALUES (?, ?, ?)';
            connection.query(consultaInsercion, [rutaRelativa, nombreArchivo, version], (err) => {
                if (err) {
                    console.error('Error al guardar el archivo en la base de datos:', err);
                }
                else {
                    console.log(`Archivo "${nombreArchivo}" (versión ${version}) guardado en la base de datos.`);
                }
            });
        }
    });
}
exports.guardarArchivoEnBaseDatos = guardarArchivoEnBaseDatos;
// Función para crear la tabla si no existe
function crearTablaSiNoExiste() {
    const consulta = `
        CREATE TABLE IF NOT EXISTS projects (
            id INT PRIMARY KEY AUTO_INCREMENT,
            ruta VARCHAR(500) UNIQUE NOT NULL,
            nombre VARCHAR(255) NOT NULL,
            version INT NOT NULL
        )`;
    connection.query(consulta, (err) => {
        if (err) {
            console.error('Error al crear la tabla en la base de datos:', err);
            return;
        }
    });
}
// Conectar a la base de datos MySQL
connection.connect(function (err) {
    if (err) {
        console.error('Error al conectar a la base de datos MySQL:', err.stack);
        return;
    }
    console.log(`Conexión establecida con la base de datos MySQL: ${connection.threadId}.`);
    // Crear la tabla si no existe
    crearTablaSiNoExiste();
    // Llamada inicial para leer los archivos desde el directorio raíz
    leerArchivos(directorioRaiz);
});
//# sourceMappingURL=index.js.map