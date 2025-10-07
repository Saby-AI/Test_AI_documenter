```java
/*
Date: 07/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Represents a communication contact that stores the type of contact (email, phone, fax)
 * and its corresponding contact information while ensuring data validation.
 */
package model;
public class Communication {
    // Type of contact, e.g., email, phone, fax
    private String contactType;
    // Actual contact information
    private String contact;
    /**
     * Constructor for the Communication class.
     *
     * @param type the type of contact (should be 'email', 'phone', or 'fax')
     * @param cont the contact information
     * @throws IllegalArgumentException if the provided contact type or information is invalid
     */
    public Communication(String type, String cont) {
        this.contactType = type;
        this.contact = cont;
        if (!valid(type, cont)) {
            throw new IllegalArgumentException("bad contact " + type);
        }
    }
    /**
     * Validates the contact information based on the contact type provided.
     *
     * @param a the type of contact
     * @param b the contact information to validate
     * @return true if the contact information is valid; false otherwise
     */
    private boolean valid(String a, String b) {
        if (a.equalsIgnoreCase("email")) {
            return b.matches("[w.-]+@[w.-]+.w{2,}");
        } else if (a.equals("phone") || a.equals("fax")) {
            return b.matches("+?[0-9- ]{7,15}");
        } else {
            return false;
        }
    }
    /**
     * Returns a string representation of the Communication instance.
     *
     * @return a formatted string containing the contact type and information
     */
    @Override
    public String toString() {
        return "Comm{" + "type:" + contactType + ", contact:" + contact + "}";
    }
}
```