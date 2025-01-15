const express = require("express");
const router = express.Router();
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const jwt = require('jsonwebtoken')

const userRegisterSchema = new mongoose.Schema({
    username: String,
    email: {type: String, unique: true, required: true},
    password: String,
    favoriteTeam: String,
    gameModes: {type: String, default: ""},
    
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

router.patch ("/update/:id", async (req, res) => {
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