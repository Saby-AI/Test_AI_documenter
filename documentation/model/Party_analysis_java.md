```
/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The Party class represents a party with a name and a number of guests.
 * It provides methods to get party details in a formatted string and print them.
 */
public class Party {
    // The name of the party.
    private String name;
    // The number of guests attending the party.
    private int guests;
    /**
     * Constructs a Party with the specified name and number of guests.
     *
     * @param name   The name of the party.
     * @param guests The number of guests attending the party.
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    /**
     * Gets the name of the party.
     *
     * @return The name of the party.
     */
    public String getName() {
        return name;
    }