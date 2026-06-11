const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'MI_LLAVE_SECRETA_DEL_HUERTO';

// Guardado temporal en memoria (Sustituto directo antes de base de datos externa)
const usuariosBD = [];
const bitacoraBD = [];

// Configuración de almacenamiento para imágenes subidas
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware para proteger rutas generales
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Acceso denegado." });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido." });
        req.usuario = decoded;
        next();
    });
}

// --- CONTROLADORES DE ACCESO Y LOGINES ---

app.post('/api/registro', async (req, res) => {
    const { nombre, correo, password } = req.body;
    if(!nombre || !correo || !password) return res.status(400).json({ error: "Campos incompletos." });

    const existe = usuariosBD.find(u => u.correo === correo);
    if(existe) return res.status(400).json({ error: "El correo ya está registrado." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = { 
        id: Date.now().toString(), 
        nombre, 
        correo, 
        password: hashedPassword, 
        rol: (correo.includes('admin') || correo.includes('ana24563')) ? 'admin' : 'usuario' 
    };
    
    usuariosBD.push(nuevoUsuario);
    res.status(201).json({ mensaje: "Usuario creado." });
});

app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    const usuario = usuariosBD.find(u => u.correo === correo);
    if(!usuario) return res.status(400).json({ error: "El usuario no existe." });

    const valido = await bcrypt.compare(password, usuario.password);
    if(!valido) return res.status(400).json({ error: "Contraseña incorrecta." });

    const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, rol: usuario.rol });
});

// --- RUTAS DE BITÁCORA ---

app.get('/api/bitacora', (req, res) => {
    res.json(bitacoraBD);
});

app.post('/api/bitacora', verificarToken, upload.single('imagen'), (req, res) => {
    const { tipoPlanta, dueno, altura, observaciones } = req.body;
    
    let imagenUrl = null;
    if (req.file) {
        const base64Data = req.file.buffer.toString('base64');
        imagenUrl = `data:${req.file.mimetype};base64,${base64Data}`;
    }

    const entrada = {
        id: Date.now().toString(),
        tipoPlanta,
        dueno,
        altura,
        observaciones,
        imagenUrl,
        fecha: new Date()
    };

    bitacoraBD.push(entrada);
    res.status(201).json(entrada);
});

app.listen(3000, () => console.log('🚀 Servidor activo en puerto 3000'));