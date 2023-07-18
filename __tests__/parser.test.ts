import fs from 'fs';
import { obtenerVersion, obtenerNombreBase, contarArchivos } from '../src/index'

describe('Funciones de obtención de versión y nombre base', () => {
  test('debería obtener la versión de un archivo correctamente', () => {
    expect(obtenerVersion('archivo.flp')).toBe(1);
    expect(obtenerVersion('archivo_2.flp')).toBe(2);
    expect(obtenerVersion('archivo_10.flp')).toBe(10);
  });

  test('debería obtener el nombre base de un archivo correctamente', () => {
    expect(obtenerNombreBase('archivo.flp')).toBe('archivo');
    expect(obtenerNombreBase('archivo_2.flp')).toBe('archivo');
    expect(obtenerNombreBase('archivo_10.flp')).toBe('archivo');
  });
});

describe('Función contarArchivos', () => {
  test('debería contar la cantidad correcta de archivos únicos .flp', () => {
    const directorioRaiz = './ruta/al/directorio'; // Ajusta la ruta según la ubicación de tus archivos de prueba
    const archivosMock = [
      'archivo.flp',
      'archivo_2.flp',
      'archivo_3.flp',
      'archivo_3.txt',
      'otro_archivo.flp',
      'otro_archivo_2.flp',
    ];

    // Crear una función mock para fs.readdirSync que devuelva los archivos de prueba
    fs.readdirSync = jest.fn(() => archivosMock);

    // Llamar a contarArchivos y esperar que cuente correctamente
    const totalArchivosContados = contarArchivos(directorioRaiz);
    expect(totalArchivosContados).toBe(4); // Esperamos 4 archivos únicos .flp
  });
});

// Aquí puedes seguir escribiendo pruebas para las demás funciones si lo deseas
export {};
