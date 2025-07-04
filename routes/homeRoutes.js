// Import the necessary libraries
const express = require("express");
const homeController = require('../controllers/homeController');
const jwt = require('jsonwebtoken')
const jwtSecret = process.env.JWTSECRET
const User = require('../models/User')


// ================== authMiddleware====================== //

const authMiddlewareForRegister = async (req, res, next) => {
    const token = req.cookies.token;
  
    if (!token) {
      return res.status(401).redirect('../login');
    }
  
    try {
      const decode = jwt.verify(token, jwtSecret);
      req.userId = decode.userId;
 
      const user = await User.findOne({'_id': decode.userId});
      if (user && user.isTeacher) {
        req.userData = user;  
        next();
      } else {
        res.clearCookie('token');
        return res.status(301).redirect('../login');
      }
    } catch (error) {
      return res.status(401).redirect('../login');
    }
}

// ================== END authMiddleware====================== //


const router = express.Router();

router.get('/', homeController.public_login_get);
router.get("/login", homeController.public_login_get);
router.post("/login", homeController.public_login_post);
router.get("/Register", authMiddlewareForRegister, homeController.public_Register_get);

router.post('/send-verification-code', homeController.send_verification_code);

router.get("/forgetPassword", homeController.forgetPassword_get);
router.post("/forgetPassword", homeController.forgetPassword_post);
router.get("/reset-password/:id/:token", homeController.reset_password_get);
router.post("/reset-password/:id/:token", homeController.reset_password_post);
router.post("/Register", authMiddlewareForRegister, homeController.public_Register_post);




        

module.exports = router;

