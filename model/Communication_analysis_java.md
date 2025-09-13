/*
Date: 13/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
package model;
/**
 * Class Communication represents different types of communication for a party.
 */
public class Communication {
    public String contactType;
    public String contact;
    /**
     * Creates a new instance of Communication.
     *
     * @param type The type of contact (e.g., email, phone).
     * @param cont The contact detail (e.g., email address or phone number).
     */
    Communication(String type, String cont) {
        contactType = type;
        contact = cont;
        if (!valid(type, cont)) {
            throw new IllegalArgumentException("Bad contact " + type);
        }
    }
    /**
     * Validates contact information based on type.
     *
     * @param a The contact type (email, phone, etc.).
     * @param b The contact information to be validated.
     * @return boolean indicating if it's valid or not.
     */
    boolean valid(String a, String b) {
        if (a.equalsIgnoreCase("email")) {
            return b.matches("[w.-]+@[w.-]+.w{2,}");
        } else if (a.equalsIgnoreCase("phone") || a.equalsIgnoreCase("fax")) {
            return b.matches("+?[0-9- ]{7,15}");
        } else {
            return false;
        }
    }