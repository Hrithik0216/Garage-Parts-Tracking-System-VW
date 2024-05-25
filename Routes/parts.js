const db = require("../db");
const express = require("express");
const router2 = express.Router();

router2.get("/allParts", async (req, res) => {
  const data = await db.query('select * from parts')
  res.send(data.rows)
})

//Ordering Parts
router2.post('/update-part', async (req, res) => {
  const { partId, partName, carModelName, incrementValue, partType } = req.body;

  try {
    // Begin transaction
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

    // Commit transaction
    await db.query('COMMIT');

    res.status(200).send('Operation completed successfully');
  } catch (error) {
    console.error('Error executing query', error);
    await db.query('ROLLBACK');
    res.status(500).send('Internal Server Error');
  }
});



module.exports = router2;
