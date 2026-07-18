/**
 * validation.js
 * -------------
 * Real-time validation helpers for the dynamically generated prediction
 * form. Each field is validated against the metadata returned by
 * GET /features (min/max/type), independent of the visual widget used.
 */

const Validation = (() => {
  /**
   * Validate a single field's raw string value against its config.
   * Returns null if valid, or an error message string if invalid.
   */
  function validateField(rawValue, fieldConfig) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      return "This field is required.";
    }

    const numValue = Number(rawValue);
    if (Number.isNaN(numValue)) {
      return "Must be a number.";
    }

    if (fieldConfig.type === "select") {
      const validValues = (fieldConfig.options || []).map((o) => Number(o.value));
      if (!validValues.includes(numValue)) {
        return "Choose one of the listed options.";
      }
      return null;
    }

    if (typeof fieldConfig.min === "number" && numValue < fieldConfig.min) {
      return `Minimum value is ${fieldConfig.min}.`;
    }
    if (typeof fieldConfig.max === "number" && numValue > fieldConfig.max) {
      return `Maximum value is ${fieldConfig.max}.`;
    }

    return null;
  }

  /**
   * Validate a full { name: value } map against the array of field configs.
   * Returns { valid: boolean, errors: { [name]: string } }
   */
  function validateForm(values, fieldConfigs) {
    const errors = {};
    fieldConfigs.forEach((cfg) => {
      const err = validateField(values[cfg.name], cfg);
      if (err) errors[cfg.name] = err;
    });
    return { valid: Object.keys(errors).length === 0, errors };
  }

  return { validateField, validateForm };
})();
