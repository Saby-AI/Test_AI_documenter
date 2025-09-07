import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
public class Party {
    private static final Logger logger = LoggerFactory.getLogger(Party.class);
    private String name;
    private int guests;
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    public String getName() {
        return name;
    }
    public int getGuests() {
        return guests;
    }
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    public void printDetails() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ").append(name).append(", Number of Guests: ").append(guests);
        logger.info(sb.toString());
    }
}