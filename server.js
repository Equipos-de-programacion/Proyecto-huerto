const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors'); 

const app = express();

// 🔓 Configuración total de CORS para permitir conexiones desde celulares y computadoras externas
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
})); 

app.use(express.json());

// Sirve los archivos estáticos (index.html, dashboard.html, imágenes) desde la carpeta 'publico'
app.use(express.static(path.join(__dirname, 'publico')));

// Configuración para recibir archivos/imágenes en las peticiones
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const JWT_SECRET = 'SECRETO_SUPER_SEGURO_PARA_EL_HUERTITO_MUSU';

// 🗄️ "Base de datos" temporales en memoria
const usuariosBD = [];
const bitacoraBD = [];

// 👑 Creación de la cuenta de Administrador por defecto al arrancar el servidor
(async () => {
    const passwordEncriptada = await bcrypt.hash('huertitos', 10);
    usuariosBD.push({
        id: "admin_arely",
        nombre: "Arely Admin 🌿",
        correo: "arely24526@cbtis75.edu.mx",
        password: passwordEncriptada,
        rol: "admin"
    });
    console.log("👤 Cuenta de Administrador (Arely) cargada exitosamente.");
})();

// ==========================================
// 🛠️ RUTAS DEL SISTEMA DE USUARIOS (API)
// ==========================================

// 1. Registro de nuevos colaboradores
app.post('/api/registro', async (req, res) => {
    try {
        const { nombre, correo, password } = req.body;
        
        // Validar si el usuario ya existe
        const existe = usuariosBD.find(u => u.correo === correo);
        if (existe) return res.status(400).json({ error: "Este correo ya está registrado." });

        // Encriptar contraseña por seguridad
        const passwordEncriptada = await bcrypt.hash(password, 10);
        
        const nuevoUsuario = {
            id: String(Date.now()),
            nombre,
            correo,
            password: passwordEncriptada,
            rol: "usuario" // Rol por defecto para el equipo
        };

        usuariosBD.push(nuevoUsuario);
        res.status(201).json({ mensaje: "¡Usuario registrado con éxito! Ya puedes iniciar sesión." });
    } catch (err) {
        res.status(500).json({ error: "Error interno al registrar usuario." });
    }
});

// 2. Inicio de sesión (Login)
app.post('/api/login', async (req, res) => {
    try {
        const { correo, password } = req.body;
        
        // Buscar usuario por correo
        const usuario = usuariosBD.find(u => u.correo === correo);
        if (!usuario) return res.status(400).json({ error: "El correo electrónico no está registrado." });

        // Verificar si la contraseña coincide
        const passwordCorrecta = await bcrypt.compare(password, usuario.password);
        if (!passwordCorrecta) return res.status(400).json({ error: "La contraseña es incorrecta." });

        // Generar pase de acceso (Token JWT)
        const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ 
            mensaje: "¡Acceso concedido!",
            token, 
            rol: usuario.rol,
            nombre: usuario.nombre 
        });
    } catch (err) {
        res.status(500).json({ error: "Error interno al iniciar sesión." });
    }
});

// ==========================================
// 🪻 RUTAS DE LA BITÁCORA DEL HUERTO
// ==========================================

// 3. Obtener todas las publicaciones del huerto
app.get('/api/bitacora', (req, res) => {
    res.json(bitacoraBD);
});

// 4. Publicar un nuevo avance en la bitácora
app.post('/api/bitacora', upload.single('imagen'), (req, res) => {
    try {
        const { dueno, tipoPlanta, altura, abono, observaciones } = req.body;

        const nuevaPublicacion = {
            _id: String(Date.now()),
            tipoPlanta: tipoPlanta || "Planta del Huerto 🌿",
            dueno: dueno || "Colaborador Anónimo",
            altura: altura || "0",
            abono: abono || "Ninguno",
            observaciones: observaciones || "",
            fecha: new Date().toLocaleDateString('es-MX'),
            likes: 0,
            comentarios: []
        };

        bitacoraBD.push(nuevaPublicacion);
        res.status(201).json(nuevaPublicacion);
    } catch (err) {
        res.status(500).json({ error: "No se pudo guardar la publicación en la bitácora." });
    }
});

// 5. Sistema de Likes para las plantas
app.post('/api/bitacora/:id/like', (req, res) => {
    const { id } = req.params;
    const publicacion = bitacoraBD.find(p => p._id === id);
    
    if (!publicacion) return res.status(404).json({ error: "Publicación no encontrada." });
    
    publicacion.likes += 1;
    res.json({ likes: publicacion.likes });
});

// ==========================================
// 🚀 ARRANQUE DEL SERVIDOR
// ==========================================
const PUERTO = 3000;
app.listen(PUERTO, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 SERVIDOR EN EJECUCIÓN`);
    console.log(`   Puerto local: http://localhost:${PUERTO}`);
    console.log(`   Recuerda poner el puerto 3000 en PUBLIC en tu Codespaces`);
    console.log(`==================================================\n`);
});