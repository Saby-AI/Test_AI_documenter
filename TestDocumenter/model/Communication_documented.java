```java
/*
Date: 28/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The `communication` class represents a communication method with a specific type and contact information.
 */
package model;
public class communication {
    public String contacttype; // The type of contact (e.g., email, phone, fax)
    public String contact;      // The actual contact information
    /**
     * Constructor for the `communication` class.
     *
     * @param type The type of contact (e.g., email, phone, fax)
     * @param cont The contact information
     * @throws IllegalArgumentException if the provided type or contact is invalid
     */
    communication(String type, String cont) {
        contacttype = type;
        contact = cont;
        if (!valid(type, cont)) {
            throw new IllegalArgumentException("bad contact " + type);
        }
    }
    /**
     * Validates the contact information based on the type.
     *
     * @param a The type of contact
     * @param b The contact information to validate
     * @return true if the contact information is valid, false otherwise
     */
    boolean valid(String a, String b) {
        if (a.toLowerCase() == "email") {
            return b.matches("[w.-]+@[w.-]+.w{2,}");
        } else if (a == "phone" || a == "fax") {
            return b.matches("+?[0-9- ]{7,15}");
        } else {
            return false;
        }
    }
    /**
     * Returns a string representation of the communication object.
     *
     * @return A string in the format "Comm{type:contacttype, contact:contact}"
     */
    public String tostring() {
        return "Comm{" + "type:" + contacttype + ", contact:" + contact + "}";
    }
}
```