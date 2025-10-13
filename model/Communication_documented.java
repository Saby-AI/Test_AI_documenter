/**
     * Validates the contact information based on the contact type.
     *
     * @param a the contact type to validate
     * @param b the contact information to validate
     * @return true if valid, false otherwise
     */
    private boolean valid(String a, String b) {
        if (a.toLowerCase().equals("email")) {
            // Validate email format using regex
            return b.matches("[w.-]+@[w.-]+.w{2,}");
        } else if (a.equals("phone") || a.equals("fax")) {
            // Validate phone and fax format using regex
            return b.matches("+?[0-9- ]{7,15}");
        } else {
            return false;
        }
    }
    /**
     * Returns a string representation of the Communication object.
     *
     * @return a string representation of the communication details
     */
    @Override
    public String toString() {
        return "Comm{" + "type:" + contactType + ", contact:" + contact + "}";
    }
}