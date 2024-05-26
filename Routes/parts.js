const db = require("../db");
const express = require("express");
const router2 = express.Router();
const verifyToken = require("../middleware/authorize")
const redis = require('redis');
const redisClient = require('../redisConfig')

//1.Get All Parts
router2.get("/allParts", verifyToken, async (req, res) => {
  try {
    const catchedParts = await redisClient.get("AllParts")
    if (catchedParts) {
      return res.status(200).send(JSON.parse(catchedParts))
    }
    const data = await db.query('select * from parts')
    const parts = data.rows
    await redisClient.set("AllParts", JSON.stringify(parts), 'EX', 3600)
    res.status(200).send(parts)
  } catch (e) {
    console.log(e)
    res.status(500).json({ message: "Internal server error" })
  }
})
//return rsponse is used so that it exits the function, ensuring no further code executed that might send another response


//2.Get one particular part
router2.get("/get-a-part", verifyToken, async (req, res) => {
  const { partId, partName } = req.body;
  try {
    const data = await db.query('select * from parts where part_id = $1 and part_name = $2', [partId, partName])
    res.send(data.rows)
  } catch (e) {
    console.log(e)
    res.status(500).send({ message: "internal server error" })
  }
})

//3.Providing parts to service vehicle

router2.post('/reduce-part', verifyToken, async (req, res) => {
  const { partId, partName, carModelName, decrementValue, partType } = req.body;

  try {
    await db.query('BEGIN');

    // Check if the part with the specified part_id, part_name, and car_model_name exists
    let selectQuery;
    let selectResult;
    if (partId) {
      selectQuery = `
        SELECT p.part_id, p.car_model_id, p.count
        FROM parts p
        JOIN parttypes pt ON p.part_type_id = pt.part_type_id
        JOIN carmodels cm ON p.car_model_id = cm.car_model_id
        WHERE p.part_id = $1
          AND p.part_name = $2
          AND cm.car_model_name = $3
        LIMIT 1;
      `;
      selectResult = await db.query(selectQuery, [partId, partName, carModelName]);
    } else {
      selectQuery = `
        SELECT p.part_id, p.car_model_id, p.count
        FROM parts p
        JOIN parttypes pt ON p.part_type_id = pt.part_type_id
        JOIN carmodels cm ON p.car_model_id = cm.car_model_id
        WHERE p.part_name = $1 AND cm.car_model_name = $2
        LIMIT 1;
      `;
      selectResult = await db.query(selectQuery, [partName, carModelName]);
    }

    if (selectResult.rows.length > 0) {
      // If the part exists, check if the decrement value is valid
      const { part_id: existingPartId, count: existingPartCount } = selectResult.rows[0];
      if (existingPartCount < decrementValue) {
        await db.query('ROLLBACK');
        return res.status(400).send({ message: 'Decrement value exceeds available count. Operation aborted.' });
      }

      // Update the count
      const updateQuery = `
        UPDATE parts
        SET count = count - $1
        WHERE part_id = $2
        RETURNING count;
      `;
      const updateResult = await db.query(updateQuery, [decrementValue, existingPartId]);

      if (updateResult.rowCount > 0) {
        const newCount = updateResult.rows[0].count;
        let response = "Parts have been sent to the respective service vehicle.";
        if (newCount < 5) {
          response += " The count of this particular part is below 5. Order more to maintain the minimum count.";
        }

        await db.query('COMMIT');
        return res.status(200).json({ message: response });
      } else {
        await db.query('ROLLBACK');
        return res.status(500).send('Failed to update the part count.');
      }
    } else {
      await db.query('ROLLBACK');
      return res.status(404).send({ message: "Part is not in stock. Please order the parts." });
    }
  } catch (error) {
    console.error('Error executing query', error);
    await db.query('ROLLBACK');
    return res.status(500).send('Internal Server Error');
  }
});



//4.Ordering Parts
router2.post('/update-part', verifyToken, async (req, res) => {
  const { partId, partName, carModelName, incrementValue, partType } = req.body;

  try {
    await db.query('BEGIN');
    // Check if the part with the specified part_id, part_name, and car_model_name exists
    let selectQuery
    let selectResult
    if (partId) {
      selectQuery = `
        SELECT p.part_id, p.car_model_id
        FROM parts p
        JOIN parttypes pt ON p.part_type_id = pt.part_type_id
        JOIN carmodels cm ON p.car_model_id = cm.car_model_id
        WHERE p.part_id = $1
          AND p.part_name = $2
          AND cm.car_model_name = $3
        LIMIT 1;
      `;
      selectResult = await db.query(selectQuery, [partId, partName, carModelName]);
    } else {
      selectQuery = `
        SELECT p.part_id, p.car_model_id
        FROM parts p
        JOIN parttypes pt ON p.part_type_id = pt.part_type_id
        JOIN carmodels cm ON p.car_model_id = cm.car_model_id
        WHERE p.part_name = $1 AND cm.car_model_name = $2
        LIMIT 1;
      `;
      selectResult = await db.query(selectQuery, [partName, carModelName]);
    }

    if (selectResult.rows.length > 0) {
      // If the part exists, update the count
      const { part_id: existingPartId } = selectResult.rows[0];
      const updateQuery = `
        UPDATE parts
        SET count = count + $1
        WHERE part_id = $2;
      `;
      await db.query(updateQuery, [incrementValue, existingPartId]);
    } else {
      // If the part doesn't exist, insert a new row
      const getCarModelIdQuery = `
        SELECT car_model_id FROM carmodels WHERE car_model_name = $1;
      `;
      const carModelResult = await db.query(getCarModelIdQuery, [carModelName]);
      const { car_model_id: carModelId } = carModelResult.rows[0];

      // Insert a new row into parts with specified columns
      const insertPartQuery = `
        INSERT INTO parts (part_id, part_name, part_type_id, count, car_model_id)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await db.query(insertPartQuery, [partId, partName, partType, incrementValue, carModelId]);
    }
    await db.query('COMMIT');
    res.status(200).json({ message: 'Operation completed successfully' });
  } catch (error) {
    console.error('Error executing query', error);
    await db.query('ROLLBACK');
    res.status(500).send('Internal Server Error');
  }
});

// -----------------------------
//5. Customers
router2.post("/new-customer", verifyToken, async (req, res) => {
  const { carNumber, customerName, count } = req.body;
  try {
    const data = await db.query(
      `INSERT INTO customers (customer_car_number, customer_name, customer_count) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (customer_car_number) 
       DO UPDATE SET customer_count = customers.customer_count + $3 
       RETURNING *`,
      [carNumber, customerName, count]
    );

    if (data.rows.length === 0) {
      res.status(201).send("Customer inserted successfully");
    } else {
      const { customer_count: serviceCount } = data.rows[0];
      let responseMessage = "Customer count updated successfully";
      if (serviceCount > 5) {
        responseMessage += ". Customer has crossed 5 service counts. Provide a service offer";
      }
      res.status(200).json({ message: responseMessage });
    }
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
});

//6. Get All customers

router2.get("/allCustomers", verifyToken, async (req, res) => {
  try {
    // Check Redis cache first
    const cachedCustomers = await redisClient.get('allCustomers');

    if (cachedCustomers) {
      // If data exists in the cache, return it
      return res.status(200).send(JSON.parse(cachedCustomers));
    }

    // If data does not exist in the cache, query the database
    const data = await db.query('SELECT * FROM customers');
    const customers = data.rows;

    // Store the result in the Redis cache with an expiration time
    await redisClient.set('allCustomers', JSON.stringify(customers), 'EX', 3600); // Cache for 1 hour
    res.status(200).send(customers);
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router2;
