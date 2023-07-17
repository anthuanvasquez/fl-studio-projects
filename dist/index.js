"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardarArchivoEnBaseDatos = exports.obtenerNombreBase = exports.obtenerVersion = exports.leerArchivos = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const commander_1 = require("commander");
const mysql2_1 = __importDefault(require("mysql2"));
const dotenv_1 = __importDefault(require("dotenv"));
let archivosProcesados = 0;
let totalArchivos = 0;
dotenv_1.default.config();
// Configuración de conexión a la base de datos MySQL
const connection = mysql2_1.default.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 3306,
});
// Parsear los argumentos de la línea de comandos
commander_1.program.option('-d, --dir <directorio>', 'Directorio raíz');
commander_1.program.parse(process.argv);
// Obtener el directorio raíz del flag --dir o utilizar uno por defecto
const directorioRaiz = commander_1.program.opts().dir;
if (!directorioRaiz) {
    throw new Error('Debes especificar el directorio raíz: --dir <directorio>.');
}
function contarArchivos(dir) {
    const archivos = fs_1.default.readdirSync(dir);
    console.log(`Archivos encontrados en el directorio ${dir}:`, archivos.length);
    const archivosConVersiones = {};
    for (const archivo of archivos) {
        const rutaCompleta = path_1.default.join(dir, archivo);
        const estadisticas = fs_1.default.statSync(rutaCompleta);
        if (estadisticas.isDirectory()) {
            contarArchivos(rutaCompleta); // Llamada recursiva para contar archivos en subdirectorios
        }
        else {
            if (path_1.default.extname(archivo) === '.flp') {
                const nombreArchivo = path_1.default.basename(archivo, path_1.default.extname(archivo));
                const nombreBase = obtenerNombreBase(nombreArchivo);
                const version = obtenerVersion(nombreArchivo);
                if (!archivosConVersiones[nombreBase] || version > archivosConVersiones[nombreBase]) {
                    archivosConVersiones[nombreBase] = version;
                    totalArchivos++;
                }
            }
        }
    }
}
function mostrarProgreso() {
    const porcentaje = totalArchivos !== 0 ? ((archivosProcesados / totalArchivos) * 100).toFixed(2) : '0.00';
    console.log(`Progreso: ${archivosProcesados}/${totalArchivos} (${porcentaje}%)`);
    if (archivosProcesados === totalArchivos) {
        console.log('¡Proceso completado!');
        // Terminar el script
        process.exit();
    }
}
/**
 * Función para recorrer los archivos y carpetas de forma recursiva.
 *
 * @param dir Directorio raíz
 */
function leerArchivos(dir) {
    const archivos = fs_1.default.readdirSync(dir);
    const archivosConVersiones = {};
    for (const archivo of archivos) {
        const rutaCompleta = path_1.default.join(dir, archivo);
        const estadisticas = fs_1.default.statSync(rutaCompleta);
        if (estadisticas.isDirectory()) {
            leerArchivos(rutaCompleta); // Llamada recursiva para leer subdirectorios
        }
        else {
            if (path_1.default.extname(archivo) !== '.flp') {
                continue; // Ignorar archivos que no tengan la extensión .flp
            }
            const nombreArchivo = path_1.default.basename(archivo, path_1.default.extname(archivo));
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
    return 1;
}
exports.obtenerVersion = obtenerVersion;
// Función para obtener el nombre base del archivo sin la versión
function obtenerNombreBase(nombreArchivo) {
    return nombreArchivo.replace(/_\d+\b/, '');
}
exports.obtenerNombreBase = obtenerNombreBase;
// Función para guardar el archivo en la base de datos
function guardarArchivoEnBaseDatos(rutaArchivo, nombreArchivo, version) {
    const rutaRelativa = path_1.default.relative(directorioRaiz, rutaArchivo);
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
                    archivosProcesados++;
                    mostrarProgreso();
                    console.log(`Archivo "${nombreArchivo}" (versión ${version}) actualizado en la base de datos.`);
                    if (archivosProcesados === totalArchivos) {
                        connection.end(); // Cerrar la conexión de la base de datos una vez que se procesen todos los archivos
                    }
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
                    archivosProcesados++;
                    mostrarProgreso();
                    console.log(`Archivo "${nombreArchivo}" (versión ${version}) guardado en la base de datos.`);
                    if (archivosProcesados === totalArchivos) {
                        connection.end(); // Cerrar la conexión de la base de datos una vez que se procesen todos los archivos
                    }
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
    // Llamada inicial para contar los archivos antes de comenzar el procesamiento
    contarArchivos(directorioRaiz);
    // Crear la tabla si no existe
    crearTablaSiNoExiste();
    // Llamada inicial para leer los archivos desde el directorio raíz
    // leerArchivos(directorioRaiz);
});
//# sourceMappingURL=index.js.map