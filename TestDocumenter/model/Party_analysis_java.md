```java
/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The Party class represents a social gathering with a specific name and a number of guests.
 */
public class Party {
    private String name;  // The name of the party
    private int guests;   // The number of guests attending the party
    /**
     * Constructor to initialize the Party object with the specified name and number of guests.
     *
     * @param name   The name of the party.
     * @param guests The number of guests attending the party.
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    /**
     * Retrieves the name of the party.
     *
     * @return The name of the party.
     */
    public String getName() {
        return name;
    }
    /**
     * Retrieves the number of guests attending the party.
     *
     * @return The number of guests.
     */
    public int getGuests() {
        return guests;
    }