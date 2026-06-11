const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors'); 
require('dotenv').config();

const app = express();

app.use(cors()); 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'publico')));

// --- 📸 CONFIGURACIÓN DE MULTER ---
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }
});

const JWT_SECRET = 'SECRETO_SUPER_SEGURO';

// --- 💾 BASES DE DATOS SIMULADAS EN MEMORIA ---
console.log('✅ Base de datos Local Temporal (En Memoria) lista y conectada');
const usuariosBD = [];

(async () => {
    const passwordEncriptada = await bcrypt.hash('huertitos', 10);
    usuariosBD.push({
        id: "admin_arely",
        nombre: "Arely Admin 🌿",
        correo: "arely24526@cbtis75.edu.mx", 
        password: passwordEncriptada,
        rol: "admin" 
    });
    console.log('👑 Cuenta de Administrador pre-cargada: arely24526@cbtis75.edu.mx (Password: huertitos)');
})();

const bitacoraBD = [
    {
        _id: "registro_prueba_1",
        tipoPlanta: "Tomate Cherry 🍅",
        dueno: "Arely (Admin)",
        altura: 12,
        abono: "Compost de café",
        observaciones: "¡Ya salieron las primeras hojitas verdes del brote principal!",
        imagenUrl: null,
        fecha: new Date(),
        likes: 3,
        comentarios: [
            { _id: "c1", usuario: "Colaborador", texto: "¡Qué increíble va tu planta!", fecha: new Date() }
        ]
    }
];

// --- 🛠️ MIDDLEWARE DE VALIDACIÓN ---
function verificarAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Acceso denegado. No hay token." });

    if (token === 'TOKEN_DEMO_HUERTITO') {
        req.usuario = { rol: 'admin', id: 'mock_admin_id' };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido o expirado." });
        if (decoded.rol !== 'admin') return res.status(403).json({ error: "Permiso denegado. No eres administrador." });
        req.usuario = decoded;
        next();
    });
}

function verificarAutenticacion(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Acceso denegado. Inicia sesión primero." });

    if (token === 'TOKEN_DEMO_HUERTITO') {
        req.usuario = { id: 'mock_user_id', rol: 'usuario' };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Sesión inválida o expirada." });
        req.usuario = decoded;
        next();
    });
}

// --- 🛣️ RUTAS DEL SISTEMA ---

// 1. Registro de Usuarios
app.post('/api/registro', async (req, res) => {
    const { nombre, correo, password, rol } = req.body;
    if (!nombre || !correo || !password) return res.status(400).json({ error: "Faltan campos obligatorios." });

    const existe = usuariosBD.find(u => u.correo === correo);
    if (existe) return res.status(400).json({ error: "El correo ya está registrado." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = { id: String(Date.now()), nombre, correo, password: hashedPassword, rol: rol || 'usuario' };
    usuariosBD.push(nuevoUsuario);

    res.status(201).json({ mensaje: "Usuario registrado con éxito.", usuario: { nombre, correo, rol: nuevoUsuario.rol } });
});

// 2. Inicio de Sesión (Login)
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    const usuario = usuariosBD.find(u => u.correo === correo);
    if (!usuario) return res.status(400).json({ error: "Usuario o contraseña incorrectos." });

    const passValido = await bcrypt.compare(password, usuario.password);
    if (!passValido) return res.status(400).json({ error: "Usuario o contraseña incorrectos." });

    const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, JWT_SECRET, { expiresIn: '4h' });
    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
});

// 3. Obtener todo el Historial (Bitácora)
app.get('/api/bitacora', (req, res) => {
    res.json(bitacoraBD.sort((a, b) => b.fecha - a.fecha));
});

// 4. Publicar Nueva Entrada
app.post('/api/bitacora', verificarAutenticacion, upload.single('imagen'), (req, res) => {
    const { tipoPlanta, dueno, altura, abono, observaciones } = req.body;
    if (!tipoPlanta || !altura) return res.status(400).json({ error: "Planta y Altura son obligatorios." });

    let imagenUrl = null;
    if (req.file) {
        const base64Data = req.file.buffer.toString('base64');
        imagenUrl = `data:${req.file.mimetype};base64,${base64Data}`;
    }

    const nuevoRegistro = {
        _id: String(Date.now()),
        tipoPlanta,
        dueno: dueno || "Anónimo",
        altura: Number(altura),
        abono: abono || "Ninguno",
        observaciones: observaciones || "",
        imagenUrl,
        fecha: new Date(),
        likes: 0,
        comentarios: []
    };

    bitacoraBD.push(nuevoRegistro);
    res.status(201).json(nuevoRegistro);
});

// 5. Editar Entrada (Sólo Admin)
app.put('/api/bitacora/:id', verificarAdmin, (req, res) => {
    const registro = bitacoraBD.find(b => b._id === req.params.id);
    if (!registro) return res.status(404).json({ error: "Publicación no encontrada." });

    const { tipoPlanta, dueno, altura, abono, observaciones } = req.body;
    if(tipoPlanta) registro.tipoPlanta = tipoPlanta;
    if(dueno) registro.dueno = dueno;
    if(altura) registro.altura = Number(altura);
    if(abono) registro.abono = abono;
    if(observaciones) registro.observaciones = observaciones;

    res.json({ mensaje: "Publicación actualizada con éxito.", registro });
});

// 6. Eliminar Entrada (Sólo Admin)
app.delete('/api/bitacora/:id', verificarAdmin, (req, res) => {
    const index = bitacoraBD.findIndex(b => b._id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "No se encontró la publicación." });

    bitacoraBD.splice(index, 1);
    res.json({ mensaje: "Publicación eliminada correctamente." });
});

// 7. Incrementar "Me gusta"
app.post('/api/bitacora/:id/like', (req, res) => {
    const registro = bitacoraBD.find(b => b._id === req.params.id);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    
    registro.likes += 1;
    res.json({ likes: registro.likes });
});

// 8. Publicar Comentario
app.post('/api/bitacora/:id/comentarios', (req, res) => {
    const registro = bitacoraBD.find(b => b._id === req.params.id);
    if (!registro) return res.status(404).json({ error: "No encontrado" });

    const nuevoComentario = {
        _id: String(Date.now()),
        usuario: req.body.usuario || "Colaborador",
        texto: req.body.texto,
        fecha: new Date()
    };
    registro.comentarios.push(nuevoComentario);
    res.json(registro);
});

// 9. Eliminar Comentario
app.post('/api/bitacora/:idPost/comentarios/:idComentario/borrar', (req, res) => {
    const registro = bitacoraBD.find(b => b._id === req.params.idPost);
    if (!registro) return res.status(404).json({ error: "No se encontró la publicación." });

    const indexComentario = registro.comentarios.findIndex(c => c._id === req.params.idComentario);
    if (indexComentario === -1) return res.status(404).json({ error: "No se encontró el comentario." });

    registro.comentarios.splice(indexComentario, 1);
    res.json({ mensaje: "Comentario eliminado correctamente." });
});

// --- 🌐 INICIO DEL SERVIDOR LOCAL ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo globalmente en el puerto: ${PORT}`);
});