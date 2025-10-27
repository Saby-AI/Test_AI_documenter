/*
Date: 27/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The Party class represents an entity involved in communication.
 * This could be a person or organization that sends or receives messages.
 * It encapsulates the essential attributes required for identifying a party
 * in a communication system, including their name and contact information.
 */
public class Party {
    private String name; // The name of the party
    private String contactInfo; // The contact information of the party
    /**
     * Gets the name of the party.
     * @return The name of the party.
     */
    public String getName() {
        return name;
    }
    /**
     * Sets the name of the party.
     * @param name The name of the party to set. Must not be null or empty.
     * @throws IllegalArgumentException if name is null or empty.
     */
    public void setName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Name must not be null or empty.");
        }
        this.name = name;
    }
    /**
     * Gets the contact information of the party.
     * @return The contact information as a String.
     */
    public String getContactInfo() {
        return contactInfo;
    }
    /**
     * Sets the contact information of the party.
     * @param contactInfo The contact information to set. Must not be null or empty.
     * @throws IllegalArgumentException if contactInfo is null or empty.
     */
    public void setContactInfo(String contactInfo) {
        if (contactInfo == null || contactInfo.trim().isEmpty()) {
            throw new IllegalArgumentException("Contact information must not be null or empty.");
        }
        this.contactInfo = contactInfo;
    }
}