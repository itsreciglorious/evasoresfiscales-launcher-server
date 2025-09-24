# Evasores Fiscales Launcher

Este es el repositorio del launcher personalizado para el servidor de Minecraft "Evasores Fiscales". Está construido con Electron y diseñado para proporcionar una experiencia de juego fluida y centralizada para los miembros del servidor.

## Características

-   **Instalación Automática de Mods:** El launcher verifica y descarga automáticamente la lista de mods requerida para el servidor desde un archivo `mods.json` alojado en GitHub.
-   **Autenticación de Microsoft:** Permite a los usuarios iniciar sesión de forma segura con sus cuentas de Microsoft.
-   **Estado del Servidor en Tiempo Real:** Muestra si el servidor está en línea y cuántos jugadores hay conectados.
-   **Sección de Noticias:** Carga y muestra las últimas noticias y anuncios del servidor desde un archivo `news.json`.
-   **Configuración de RAM:** Permite a los usuarios ajustar la cantidad de memoria RAM asignada al juego.
-   **Actualizaciones Automáticas:** El propio launcher se actualiza automáticamente cuando se publica una nueva versión en GitHub Releases.
-   **Interfaz Intuitiva:** Diseño simple y fácil de usar.

## Instalación (Para Jugadores)

1.  Ve a la sección de **Releases** en GitHub.
2.  Descarga el archivo `.exe` de la última versión (por ejemplo, `Evasores Fiscales Launcher Setup X.Y.Z.exe`).
3.  Ejecuta el instalador y sigue las instrucciones. ¡Listo!

## Configuración para Desarrollo

Si quieres modificar o contribuir al código del launcher, sigue estos pasos:

### Prerrequisitos

-   Node.js (versión LTS recomendada)
-   npm (normalmente se instala con Node.js)

### Pasos

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/itsreciglorious/evasoresfiscales-launcher-server.git
    cd evasoresfiscales-launcher-server
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Ejecuta en modo de desarrollo:**
    Este comando iniciará el launcher y abrirá las herramientas de desarrollo.
    ```bash
    npm start
    ```

4.  **Compila el ejecutable:**
    Para generar el instalador `.exe` para Windows, ejecuta:
    ```bash
    npm run build
    ```
    Los archivos de distribución se crearán en la carpeta `dist/`.

## Estructura del Proyecto

-   `main.js`: El corazón de la aplicación Electron. Controla la ventana principal, la comunicación entre procesos (IPC) y toda la lógica de backend (descargas, inicio del juego, etc.).
-   `preload.js`: Un script que actúa como puente seguro entre el backend (`main.js`) y el frontend (`renderer.js`), exponiendo solo las funciones necesarias.
-   `src/`: Contiene todos los archivos del frontend.
    -   `index.html`: La estructura de la interfaz de usuario.
    -   `style.css`: Los estilos visuales del launcher.
    -   `renderer.js`: La lógica del frontend que maneja la interacción del usuario y la comunicación con `main.js`.
-   `package.json`: Define el proyecto, sus dependencias y los scripts para ejecutar y compilar.
-   `build/`: Contiene los recursos para la compilación, como el icono de la aplicación.
