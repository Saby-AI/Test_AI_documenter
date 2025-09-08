/**
 * The Party class represents a social gathering with a name and a number of guests.
 * It provides methods to access party details and print them.
 */
public class Party {
    private String name; // The name of the party
    private int guests; // The number of guests attending the party
    /**
     * Constructor to initialize the party with a name and number of guests.
     * @param name The name of the party
     * @param guests The number of guests attending the party
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    /**
     * Gets the name of the party.
     * @return The name of the party
     */
    public String getName() {
        return name;
    }
    /**
     * Gets the number of guests attending the party.
     * @return The number of guests
     */
    public int getGuests() {
        return guests;
    }
    /**
     * Formats the details of the party into a string.
     * @return A string containing the party name and number of guests
     */
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    /**
     * Prints the details of the party to the console.
     */
    public void printDetails() {
        System.out.println(formatDetails());
    }
}