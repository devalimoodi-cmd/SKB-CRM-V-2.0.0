const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerRegistrationController");
const { protect, authorize } = require("../middleware/auth");

// ------------------------Start new customer   Data Table-----------------
router.post(
  "/register",
  protect,
  authorize("expert", "admin", "super_admin"),
  customerController.registerCustomer,
);
// ------------------------finsh new customer   Data Table-----------------

// ------------------------Start get all  Customer  Data Table-----------------
router.get("/", customerController.getAllCustomers);
// ------------------------finish get all  Customer  Data Table-----------------

// ------------------------Start Deleted Customer btn In Data Table-----------------
router.delete(
  "/:id",
  protect,
  authorize("super_admin"),
  customerController.deleteCustomer,
);
// ------------------------finish Deleted Customer btn In Data Table-----------------

// -----------------------------------start enable/disable customer  in data table--------------------
router.put("/:id/disable", protect, customerController.toggleCustomerStatus);
router.put("/:id/enable", protect, customerController.toggleCustomerStatus);
// -----------------------------------finish enable/disable customer  in data table--------------------

// -----------------------------------start view data customer  in data table--------------------
router.get("/:id", customerController.getCustomerById);
// -----------------------------------finish view data customer   in data table--------------------

// ✅---------------------- start edit customer btn (با protect) -------------
router.put("/:id", protect, customerController.updateCustomer);
// ✅ -------------------- finish edit customer btn -------------

module.exports = router;
