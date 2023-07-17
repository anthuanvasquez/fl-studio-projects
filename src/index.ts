import * as fs from 'fs';
import * as path from 'path';
import * as commander from 'commander';
import * as mysql from 'mysql';
import * as dotenv from 'dotenv';


dotenv.config();

// Configuración de conexión a la base de datos MySQL
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

// Parsear los argumentos de la línea de comandos
commander.option('--dir <directorio>', 'Directorio raíz').parse(process.argv);

// Obtener el directorio raíz del flag --dir o utilizar uno por defecto
const directorioRaiz = commander.dir;

/**
 * Función para recorrer los archivos y carpetas de forma recursiva.
 *
 * @param   {string}  dir  [dir description]
 * @return  {void}         [return description]
 */
export function leerArchivos(dir: string): void {
    const archivos: string[] = fs.readdirSync(dir);

    const archivosConVersiones: {
        [nombreBase: string]: {
            ruta: string;
            nombre: string;
            version: number;
        };
    } = {};

    for (const archivo of archivos) {
        const rutaCompleta = path.join(dir, archivo);
        const estadisticas = fs.statSync(rutaCompleta);

        if (estadisticas.isDirectory()) {
            leerArchivos(rutaCompleta); // Llamada recursiva para leer subdirectorios
        } else {
            const nombreArchivo = path.basename(archivo, path.extname(archivo));
            const version = obtenerVersion(nombreArchivo);

            if (version > 0) {
                const nombreBase = obtenerNombreBase(nombreArchivo);
                if (
                    !archivosConVersiones[nombreBase] ||
                    version > archivosConVersiones[nombreBase].version
                ) {
                    archivosConVersiones[nombreBase] = {
                        ruta: rutaCompleta,
                        nombre: nombreArchivo,
                        version: version,
                    };
                }
            } else {
                guardarArchivoEnBaseDatos(rutaCompleta, nombreArchivo, 0);
            }
        }
    }

    for (const nombreArchivo in archivosConVersiones) {
        const archivo = archivosConVersiones[nombreArchivo];
        guardarArchivoEnBaseDatos(archivo.ruta, archivo.nombre, archivo.version);
    }
}

// Función para obtener el número de versión del archivo
export function obtenerVersion(nombreArchivo: string): number {
    const versionMatch = nombreArchivo.match(/_(\d+)\b/);
    if (versionMatch) {
        return parseInt(versionMatch[1]);
    }
    return 0;
}

// Función para obtener el nombre base del archivo sin la versión
export function obtenerNombreBase(nombreArchivo: string): string {
    return nombreArchivo.replace(/_\d+\b/, '');
}

// Función para guardar el archivo en la base de datos
export function guardarArchivoEnBaseDatos(
    rutaArchivo: string,
    nombreArchivo: string,
    version: number
): void {
    const rutaRelativa = path.relative(directorioRaiz, rutaArchivo);
    const consultaExistencia = 'SELECT id FROM archivos WHERE ruta = ?';

    connection.query(consultaExistencia, [rutaRelativa], (err, result) => {
        if (err) {
            console.error('Error al verificar la existencia del archivo en la base de datos:', err);
        } else if (result.length > 0) {
            // El archivo ya existe en la base de datos, realizar la actualización
            const idArchivo = result[0].id;
            const consultaActualizacion = 'UPDATE archivos SET nombre = ?, version = ? WHERE id = ?';

            connection.query(consultaActualizacion, [nombreArchivo, version, idArchivo], (err) => {
                if (err) {
                    console.error('Error al actualizar el archivo en la base de datos:', err);
                } else {
                    console.log(`Archivo "${nombreArchivo}" (versión ${version}) actualizado en la base de datos.`);
                }
            });
        } else {
            // El archivo no existe en la base de datos, realizar la inserción
            const consultaInsercion = 'INSERT INTO archivos (ruta, nombre, version) VALUES (?, ?, ?)';

            connection.query(consultaInsercion, [rutaRelativa, nombreArchivo, version], (err) => {
                if (err) {
                    console.error('Error al guardar el archivo en la base de datos:', err);
                } else {
                    console.log(`Archivo "${nombreArchivo}" (versión ${version}) guardado en la base de datos.`);
                }
            });
        }
    });
}

// Función para crear la tabla si no existe
function crearTablaSiNoExiste(): void {
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
        }
    });
}

// Conectar a la base de datos MySQL
connection.connect(function (err) {
    if (err) {
        console.error('Error al conectar a la base de datos MySQL:', err);
        return;
    }

    console.log('Conexión establecida con la base de datos MySQL.');

    // Crear la tabla si no existe
    crearTablaSiNoExiste();

    // Llamada inicial para leer los archivos desde el directorio raíz
    leerArchivos(directorioRaiz);
});
