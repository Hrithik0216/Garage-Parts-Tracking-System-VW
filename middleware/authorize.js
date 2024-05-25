const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = function (req, res, next) {
    const token = req.header("token")
    if (!token) {
        return res.status(403).send({ message: "unauthorized" })
    }
    try {
        const verify = jwt.verify(token, process.env.jwtSecret)
        //The decoded payload (user information) is assigned to req.user, 
        //making it available to subsequent middleware functions or route handlers.
        req.user = verify.user;
        next();
    } catch (e) {
        console.log(e);
        res.status(401).send({ message: "Token not valid" })
    }
}

//Authorization middleware is going to check if the token sent to us is valid or not