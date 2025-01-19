const express = require("express");
const router = express.Router();
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const jwt = require('jsonwebtoken')
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');



const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; 
  
    if (!token) {
      return res.status(401).json({ error: 'Access denied, no token provided' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET); 
      req.user = decoded; 
      next(); 
    } catch (error) {
      res.status(403).json({ error: 'Invalid token' });
    }
  };

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


  // Configuração do Multer
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'profile_pics', // Pasta no Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg'], // Formatos permitidos
    },
});

const upload = multer({ storage });


const userRegisterSchema = new mongoose.Schema({
    username: String,
    email: {type: String, unique: true, required: true},
    password: String,
    favoriteTeam: String,
    gameModes: {type: String, default: ""},
    profilePic: String
    
})

const UserRegister = mongoose.model('UserRegister', userRegisterSchema)


router.get ("/", async (req, res) => {
    try {
        const users = await UserRegister.find()
        res.send(users)
    } catch (error) {
        res.status(500).json({error: 'Failed to fetch'})
        console.log(error)
        
    }
})

router.get("/protected-route", authenticateToken, async (req, res) => {
    try {
        // Buscar o usuário pelo ID decodificado do token
        const user = await UserRegister.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Retornar todas as informações do usuário
        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            favoriteTeam: user.favoriteTeam,
            gameModes: user.gameModes,
            profilePic: user.profilePic, // Certifique-se de que o campo esteja no modelo
        });
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

router.post ("/register", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)


        const newUser = new UserRegister ({
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            favoriteTeam: req.body.favoriteTeam,
            gameModes: req.body.gameModes
            
            
        });

        await newUser.save()
        res.send(newUser)
    } catch (error) {
        res.status(400).json({error:"Failed to create record"})
        console.log(error)
    }
})

router.post('/login', async (req, res) => {
    const { email, password } = req.body; 
  
    try {
   
      const user = await UserRegister.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
  
      
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' }); 
      }
  
      
      const token = jwt.sign(
        { userId: user._id, username: user.username }, 
        process.env.JWT_SECRET,
        { expiresIn: '1h' } 
      );
  
      
      res.json({ token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' }); 
    }
  });


  router.post('/upload-profile-pic/:id', upload.single('profilePic'), async (req, res) => {
    const userId = req.params.id;

    try {
        // Atualiza o campo profilePic do usuário no banco
        const user = await UserRegister.findByIdAndUpdate(
            userId,
            { profilePic: req.file.path }, // O caminho público gerado pelo Cloudinary
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Profile picture uploaded successfully', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

router.patch ("/update/:id", authenticateToken, async (req, res) => {
    const id = req.params.id;
    let hashedPassword;

    if(req.body.password) {
        hashedPassword = await bcrypt.hash(req.body.password, 10)
    }

    try {
        const updateUser = await UserRegister.findByIdAndUpdate(id, 
            {
                username: req.body.username,
                email: req.body.email,
                password: hashedPassword || undefined,
                favoriteTeam: req.body.favoriteTeam,
                gameModes: req.body.gameModes
            },
        {
            new: true,
            runValidators: true
        }
        )

        if(!updateUser) {
            return res.status(404).json({error: 'User not found'})
        }
        res.json(updateUser)

    } catch (error) {
        res.status(400).json({error: 'Failed to update', details: error.message})
    }
})


module.exports = router