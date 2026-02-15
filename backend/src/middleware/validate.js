const { ZodError } = require("zod");

const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      return res.status(400).json({
        message: "Validation failed",
        errors: err.errors,
      });
    }
  };
};

module.exports = {
  validate,
};
