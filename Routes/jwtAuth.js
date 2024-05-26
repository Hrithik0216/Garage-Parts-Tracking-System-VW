const db = require("../db");
const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');
const jwtGenerator = require("../utils/jwtGenerator");
//Middlewares
const validInfo = require("../middleware/validInfo")
const authorize = require("../middleware/authorize")

//(1)Get all users
router.get("/getAll", async (req, res) => {
    try {
        const getAll = await db.query("SELECT * FROM users");
        console.log(getAll.rows[0]);
        res.status(200).json(getAll.rows);
    } catch (e) {
        console.error(e);
        res.status(500).send({ message: "Server error" });
    }
});


// (2) Register Route
// 1. Destructure MediaList, name, password
// 2. Check if the user already exists (If so, throw error)
// 3. Bcrypt password
// 4. Create a new user
// 5. Generate jwt token
router.post("/register", validInfo, async (req, res) => {
    const { name, email, password } = req.body;
    try {
        // Check if the user already exists
        const user = await db.query("SELECT * FROM users WHERE user_mail = $1", [email]);
        if (user.rows.length !== 0) {
            return res.status(401).send({ message: "User already exists" });
        }

        // Hash the password
        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const bcryptPassword = await bcrypt.hash(password, salt);

        // Insert the new user
        const newUser = await db.query(
            "INSERT INTO users(user_name, user_mail, user_password) VALUES($1, $2, $3) RETURNING *",
            [name, email, bcryptPassword]
        );

        // Generate a JWT token
        const token = jwtGenerator(newUser.rows[0].user_id);

        res.status(200).json({ token, message: "User has been created" });
    } catch (e) {
        console.error(e);
        res.status(500).send({ message: "Server error" });
    }
});

//(3)LoginRoute
// 1. Destructure MediaList, name, password
// 2. Check if the user already exists 
// 3. Check if the incoming password is same as given password
// 4. Generate jwt token
// Login Route
router.post("/login", async (req, res) => {
    const { mail, password } = req.body;
    try {
        // Check if the user exists
        const user = await db.query("SELECT * FROM users WHERE user_mail = $1", [mail]);
        if (user.rows.length === 0) {
            return res.status(401).send({ message: "Please register (Unauthenticated)." });
        }

        // Validate password
        const validPassword = await bcrypt.compare(password, user.rows[0].user_password);
        if (!validPassword) {
            return res.status(401).json("Invalid Credentials");
        }

        // Generate a JWT token
        const token = jwtGenerator(user.rows[0].user_id);

        res.status(200).json({ token, message: "User has been authenticated" });
    } catch (e) {
        console.error(e);
        res.status(500).send({ message: "Server error" });
    }
});

router.get("/getVerified", authorize, async (req, res) => {
    try {
        res.json(true)
    } catch (e) {
        console.log(e)
        res.status(401).send({ message: "Unauthorized" })
    }
})

module.exports = router;
