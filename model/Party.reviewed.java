import java.util.Date;
/**
 * Represents a party with a name, location, date, and guest count.
 */
public class Party {
    private final String name;
    private final String location;
    private final Date date;
    private final int guestCount;
    public Party(String name, String location, Date date, int guestCount) {
        this.name = name;
        this.location = location;
        this.date = date;
        this.guestCount = guestCount;
    }
    public Party() {
        this.name = "";
        this.location = "";
        this.date = new Date();
        this.guestCount = 0;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public String getLocation() {
        return location;
    }
    public void setLocation(String location) {
        this.location = location;
    }
    public Date getDate() {
        return date;
    }
    public void setDate(Date date) {
        this.date = date;
    }
    public int getGuestCount() {
        return guestCount;
    }
    public void setGuestCount(int guestCount) {
        this.guestCount = guestCount;
    }
    @Override
    public String toString() {
        return "Party{name='" + name + ''' + ", location='" + location + ''' + ", date=" + date + ", guestCount=" + guestCount + '}';
    }
}