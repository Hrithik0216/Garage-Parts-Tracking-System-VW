module.exports = function (req, res, next) {
    const { email, name, password } = req.body;
    console.log('Request Body:', req.body);

    function validEmail(userEmail) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(userEmail);
    }

    if (req.path === "/register") {
        // console.log(email.length);
        //   every(Boolean) checks if all elements are truthy.
        if (![email, name, password].every(Boolean)) {
            return res.status(401).json("Missing Credentials");
        } else if (!validEmail(email)) {
            return res.status(401).json("Invalid Email");
        }

    } else if (req.path === "/login") {
        if (![email, password].every(Boolean)) {
            return res.json("Missing Credentials");
        } else if (!validEmail(email)) {
            return res.json("Invalid Email");
        }
    }
    next();
};