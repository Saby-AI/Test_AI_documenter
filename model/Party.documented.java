/**
 * Represents a party with a name and a number of guests.
 *
 * The Party class provides methods to get the party name, number of guests,
 * format the details of the party, and print those details using a logging framework.
 */
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
public class Party {
    private static final Logger logger = LoggerFactory.getLogger(Party.class);
    private String name;
    private int guests;
    /**
     * Creates a new Party instance.
     *
     * @param name    the name of the party
     * @param guests  the number of guests invited to the party
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    /**
     * Gets the name of the party.
     *
     * @return the name of the party
     */
    public String getName() {
        return name;
    }
    /**
     * Gets the number of guests invited to the party.
     *
     * @return the number of guests
     */
    public int getGuests() {
        return guests;
    }
    /**
     * Formats the party details as a string.
     *
     * @return a string representing party details
     */
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    /**
     * Prints the party details to the log.
     */
    public void printDetails() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ").append(name).append(", Number of Guests: ").append(guests);
        logger.info(sb.toString());
    }
}