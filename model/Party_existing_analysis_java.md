/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
package model;
/**
 * Represents a party with its essential details, including the name and number of guests.
 * This class allows for the storage and retrieval of party details for management
 * and display purposes.
 *
 * NOTE: This is the existing Party class from the repository, which has a different
 * structure than what Main.java expects. This class focuses on party planning
 * with guest management, while Main.java expects a business entity Party class.
 */
public class Party {
    /** Name of the party */
    private String name;
    /** Number of guests attending the party */
    private int guests;
    /**
     * Constructs a new Party object with the specified name and guest count.
     *
     * @param name   The name of the party.
     * @param guests The initial number of guests attending the party.
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    /**
     * Sets the name of the party.
     *
     * @param name The new name for the party.
     */
    public void setName(String name) {
        this.name = name;
    }
    /**
     * Retrieves the name of the party.
     *
     * @return The name of the party.
     */
    public String getName() {
        return name;
    }