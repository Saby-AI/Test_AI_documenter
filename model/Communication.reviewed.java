package model;
public class Communication {
    private String contactType;
    private String contact;
    // Constructor to initialize contact type and contact
    public Communication(String type, String cont) {
        this.contactType = type;
        this.contact = cont;
        if (!isValid(type, cont)) {
            throw new IllegalArgumentException("Invalid contact: " + type);
        }
    }
    // Method to validate contact based on type
    private boolean isValid(String type, String value) {
        switch (type.toLowerCase()) {
            case "email":
                return value.matches("[w.-]+@[w.-]+.w{2,}");
            case "phone":
            case "fax":
                return value.matches("+?[0-9- ]{7,15}");
            default:
                return false;
        }
    }
    // Override toString method to provide meaningful output
    @Override
    public String toString() {
        return "Comm{type: " + contactType + ", contact: " + contact + "}";
    }
}