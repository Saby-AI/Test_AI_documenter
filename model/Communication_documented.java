// Method to validate contact details based on type
    boolean valid(String a, String b) {
        // Email validation
        if (a.toLowerCase().equals("email")) {
            return b.matches("[w.-]+@[w.-]+.w{2,}"); // Check email format
        } else if (a.equals("phone") || a.equals("fax")) { // Phone or Fax validation
            return b.matches("+?[0-9- ]{7,15}"); // Check phone or fax format
        } else {
            return false; // Invalid type
        }
    }
    // String representation of the Communication object
    @Override
    public String toString() {
        return "Comm{" + "type:" + contactType + ", contact:" + contact + "}"; // Output format
    }
}