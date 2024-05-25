const express = require("express");
const app = express();
const port = 8000;
const cors = require('cors');
const router = require("./Routes/jwtAuth");
const router2 = require("./Routes/parts")


app.use(cors());
app.use(express.json());
app.use("/auth", router);
app.use("/parts", router2)

app.listen(port, () => {
    console.log(`Listening to ${port}`);
});
