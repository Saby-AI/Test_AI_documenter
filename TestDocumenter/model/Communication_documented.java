/**
     * Validates the provided contact information based on the contact type.
     *
     * @param a the type of contact (e.g., "email", "phone", "fax")
     * @param b the contact detail to validate
     * @return true if the contact detail is valid; false otherwise
     */
    boolean valid(String a, String b) {
        if(a.toLowerCase().equals("email")) {
            return b.matches("[w.-]+@[w.-]+.w{2,}");
        } else if(a.equals("phone") || a.equals("fax")) {
            return b.matches("+?[0-9- ]{7,15}");
        } else {
            return false;
        }
    }
    /**
     * Returns a string representation of the Communication object.
     *
     * @return a formatted string indicating the contact type and contact details
     */
    public String tostring() {
        return "Comm{" + "type:" + contacttype + ", contact:" + contact + "}";
    }
}