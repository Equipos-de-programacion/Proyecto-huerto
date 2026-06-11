const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'publico')));

// --- 📸 CONFIGURACIÓN DE MULTER OPTIMIZADA ---
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }
});

const JWT_SECRET = 'SECRETO_SUPER_SEGURO';

// --- 💾 BASES DE DATOS SIMULADAS EN MEMORIA (No requieren MongoDB) ---
console.log('✅ Base de datos Local Temporal (En Memoria) lista y conectada');
const usuariosBD = [];
const bitacoraBD = [];

// --- 🛠️ MIDDLEWARE DE VALIDACIÓN CORREGIDO ---
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
        if (decoded.rol !== 'admin') return res.status(403).json({ error: "Acceso denegado. Se requiere rol de Admin." });
        
        req.usuario = decoded;
        next();
    });
}

// --- RUTAS API ---

// 1. Registro
app.post('/api/registro', async (req, res) => {
    try {
        const { nombre, correo, password, rol } = req.body;
        
        const existe = usuariosBD.find(u => u.correo === correo);
        if (existe) return res.status(400).json({ error: "El correo ya existe" });

        const passwordHash = await bcrypt.hash(password, 10);
        const nuevoUsuario = { _id: String(Date.now()), nombre, correo, password: passwordHash, rol: rol || 'usuario' };
        usuariosBD.push(nuevoUsuario);

        res.json({ nombre: nuevoUsuario.nombre, correo: nuevoUsuario.correo, rol: nuevoUsuario.rol });
    } catch (e) {
        res.status(400).json({ error: "Error en el registro" });
    }
});

// 2. Login
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    const user = usuariosBD.find(u => u.correo === correo);
    if (!user) return res.status(400).json({ error: "No existe el usuario" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, rol: user.rol }, JWT_SECRET);
    res.json({ token, rol: user.rol });
});

// 3. Obtener Bitácora
app.get('/api/bitacora', (req, res) => {
    res.json([...bitacoraBD].reverse());
});

// 4. Guardar Bitácora
app.post('/api/bitacora', upload.single('imagen'), async (req, res) => {
    try {
        let imagenBase64 = '';
        if (req.file) {
            imagenBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        } else {
            imagenBase64 = "https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?q=80&w=500";
        }

        const nuevaEntrada = {
            _id: String(Date.now()),
            tipoPlanta: req.body.tipoPlanta,
            dueno: req.body.dueno || "Anónimo", 
            altura: Number(req.body.altura) || 0,
            abono: req.body.abono || "Ninguno",
            observaciones: req.body.observaciones,
            imagenUrl: imagenBase64,
            fecha: new Date(),
            likes: 0,
            comentarios: []
        };
        
        bitacoraBD.push(nuevaEntrada);
        res.json({ mensaje: "Guardado con éxito" });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor al intentar guardar" });
    }
});

// 5. Modificar una Publicación
app.put('/api/bitacora/:id', verificarAdmin, (req, res) => {
    const index = bitacoraBD.findIndex(b => b._id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "No se encontró la publicación." });

    const { tipoPlanta, dueno, altura, abono, observaciones } = req.body;
    bitacoraBD[index] = {
        ...bitacoraBD[index],
        tipoPlanta: tipoPlanta || bitacoraBD[index].tipoPlanta,
        dueno: dueno || bitacoraBD[index].dueno,
        altura: altura !== undefined ? Number(altura) : bitacoraBD[index].altura,
        abono: abono || bitacoraBD[index].abono,
        observaciones: observaciones || bitacoraBD[index].observaciones
    };

    res.json({ mensaje: "¡Publicación modificada con éxito!", registroActualizado: bitacoraBD[index] });
});

// 6. Eliminar entrada completa
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
    if (!registro) return res.status(404).json({ error: "No encontrado" });

    registro.comentarios = registro.comentarios.filter(c => c._id !== req.params.idComentario);
    res.json(registro);
});

// --- 🚀 INICIO ENLACE ADAPTATIVO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor corriendo globalmente en el puerto: ${PORT}`);
});