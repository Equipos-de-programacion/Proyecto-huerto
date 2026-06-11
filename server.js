const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const JWT_SECRET = 'SECRETO_MAXIMO_HUERTITO_MUSU_2026';

// Bases de datos temporales en memoria
const usuariosBD = [];
const bitacoraBD = [];
const anunciosBD = [];

// Configuración de Multer para recibir cualquier archivo en memoria (Imágenes o Documentos)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 25 * 1024 * 1024 } });

// Administrador por defecto
(async () => {
    const hash = await bcrypt.hash('huertitos', 10);
    usuariosBD.push({
        id: "admin_arely",
        nombre: "Arely Admin 🌿",
        correo: "arely24526@cbtis75.edu.mx",
        password: hash,
        rol: "admin"
    });
    console.log("👑 Cuenta de Administrador Maestra inicializada con éxito.");
})();

// Middleware de Autenticación
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "No autorizado." });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Sesión expirada." });
        req.usuario = decoded;
        next();
    });
}

// ==========================================
// RUTAS DE AUTENTICACIÓN Y GESTIÓN DE ROLES
// ==========================================

app.post('/api/registro', async (req, res) => {
    const { nombre, correo, password } = req.body;
    if (!nombre || !correo || !password) return res.status(400).json({ error: "Campos incompletos." });

    const cClean = correo.trim().toLowerCase();
    if (usuariosBD.find(u => u.correo === cClean)) return res.status(400).json({ error: "El correo ya existe." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const esAdminPredefinido = cClean.includes('admin') || cClean.includes('ana24563') || cClean === 'arely24526@cbtis75.edu.mx';
    
    const nuevoUsuario = {
        id: String(Date.now()),
        nombre,
        correo: cClean,
        password: hashedPassword,
        rol: esAdminPredefinido ? 'admin' : 'usuario'
    };

    usuariosBD.push(nuevoUsuario);
    res.status(201).json({ mensaje: "Usuario registrado." });
});

app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    const cClean = correo.trim().toLowerCase();
    const usuario = usuariosBD.find(u => u.correo === cClean);
    if (!usuario) return res.status(400).json({ error: "Usuario no encontrado." });

    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) return res.status(400).json({ error: "Contraseña incorrecta." });

    const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol }, JWT_SECRET, { expiresIn: '6h' });
    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
});

// Otorgar rango de Administrador a otro usuario (Sólo Administradores)
app.post('/api/usuarios/hacer-admin', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: "Permiso denegado. No eres administrador." });
    const { correo } = req.body;
    
    const usuario = usuariosBD.find(u => u.correo === correo.trim().toLowerCase());
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });

    usuario.rol = 'admin';
    res.json({ mensaje: `¡${usuario.nombre} ahora es Administrador! ✨` });
});

app.get('/api/usuarios', verificarToken, (req, res) => {
    const lista = usuariosBD.map(u => ({ nombre: u.nombre, correo: u.correo, rol: u.rol }));
    res.json(lista);
});

// ==========================================
// RUTAS DE LA BITÁCORA, CRONOGRAMAS Y DIAGRAMAS
// ==========================================

app.get('/api/bitacora', (req, res) => {
    res.json(bitacoraBD);
});

app.post('/api/bitacora', verificarToken, upload.single('archivo'), (req, res) => {
    const { tipoPlanta, dueno, altura, abono, observaciones } = req.body;

    let adjunto = null;
    if (req.file) {
        adjunto = {
            nombreArchivo: req.file.originalname,
            mimeType: req.file.mimetype,
            datosBase64: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
        };
    }

    const nuevaPublicacion = {
        _id: String(Date.now()),
        tipoPlanta: tipoPlanta || "Planta del Huertito 🌿",
        dueno: dueno || req.usuario.nombre,
        usuarioId: req.usuario.id,
        altura: altura || "0",
        abono: abono || "Ninguno",
        observaciones: observaciones || "",
        adjunto,
        fecha: new Date().toLocaleDateString('es-MX'),
        // Estructuras de Cronograma y Diagrama por defecto editables
        cronograma: [
            { id: 1, tarea: "Germinación", inicio: "2026-06-01", fin: "2026-06-05", progreso: 100 },
            { id: 2, tarea: "Riego y Nutrición", inicio: "2026-06-06", fin: "2026-06-12", progreso: 40 }
        ],
        diagrama: [
            { paso: 1, titulo: "Plantar Semilla", desc: "Colocar en sustrato orgánico húmedo." },
            { paso: 2, titulo: "Control de Luz", desc: "Exponer a luz indirecta 6 hrs diarias." }
        ]
    };

    bitacoraBD.unshift(nuevaPublicacion);
    res.status(201).json(nuevaPublicacion);
});

// Modificar Cronograma de una Publicación
app.put('/api/bitacora/:id/cronograma', verificarToken, (req, res) => {
    const { id } = req.params;
    const { cronograma } = req.body;
    const publicacion = bitacoraBD.find(p => p._id === id);

    if (!publicacion) return res.status(404).json({ error: "No se encontró la planta." });
    if (publicacion.usuarioId !== req.usuario.id && req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: "No tienes permiso para editar esta planta." });
    }

    publicacion.cronograma = cronograma;
    res.json({ mensaje: "Cronograma actualizado con éxito.", cronograma: publicacion.cronograma });
});

// Modificar Diagrama de Flujo de una Publicación
app.put('/api/bitacora/:id/diagrama', verificarToken, (req, res) => {
    const { id } = req.params;
    const { diagrama } = req.body;
    const publicacion = bitacoraBD.find(p => p._id === id);

    if (!publicacion) return res.status(404).json({ error: "No se encontró la planta." });
    if (publicacion.usuarioId !== req.usuario.id && req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: "No tienes permiso para editar esta planta." });
    }

    publicacion.diagrama = diagrama;
    res.json({ mensaje: "Diagrama de flujo actualizado con éxito.", diagrama: publicacion.diagrama });
});

// Eliminar Publicación
app.delete('/api/bitacora/:id', verificarToken, (req, res) => {
    const index = bitacoraBD.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "No encontrado" });

    if (bitacoraBD[index].usuarioId !== req.usuario.id && req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: "No autorizado." });
    }

    bitacoraBD.splice(index, 1);
    res.json({ mensaje: "Eliminado." });
});

// ==========================================
// TABLÓN DE ANUNCIOS OFICIALES (ADMINS)
// ==========================================

app.get('/api/anuncios', (req, res) => {
    res.json(anunciosBD);
});

app.post('/api/anuncios', verificarToken, upload.single('archivo'), (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: "Solo administradores." });
    const { titulo, contenido } = req.body;

    let adjunto = null;
    if (req.file) {
        adjunto = {
            nombreArchivo: req.file.originalname,
            mimeType: req.file.mimetype,
            datosBase64: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
        };
    }

    const nuevoAnuncio = {
        id: String(Date.now()),
        titulo,
        contenido,
        autor: req.usuario.nombre,
        adjunto,
        fecha: new Date().toLocaleString('es-MX')
    };

    anunciosBD.unshift(nuevoAnuncio);
    res.status(201).json(nuevoAnuncio);
});

// Iniciar servidor
app.listen(3000, () => console.log('🚀 Servidor del Macro-Sistema Huerto MUSU corriendo en http://localhost:3000'));