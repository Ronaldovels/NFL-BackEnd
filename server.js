const express = require("express");
const app = express();
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");

app.use(express.json());
app.use(cors())
dotenv.config()

const port = process.env.PORT
const url = process.env.URL
const api = process.env.API


mongoose.connect(url)
    .then(() => console.log("Connected to DB"))
    .catch((error) => console.log("Failed to enter DB", error))
    

const userRegisterRoute = require('./routes/userRegister')
app.use("/", userRegisterRoute)
   


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });