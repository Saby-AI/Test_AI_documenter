/*
Date: 04/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * This class represents a Party with a name and a number of guests.
 * It provides methods for retrieving the name and number of guests,
 * and for formatting and printing party details.
 */
public class Party {
    // The name of the party
    private String name;
    // The number of guests at the party
    private int guests;
    /**
     * Constructor to initialize the Party object with a name and number of guests.
     *
     * @param name  The name of the party
     * @param guests The number of guests at the party
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    // Setters have been commented out, indicating that this class's parties are immutable for name and guests.
    // public void setName(String name) {
    // }
    /**
     * Gets the name of the party.
     *
     * @return The name of the party
     */
    public String getName() {
        return name;
    }