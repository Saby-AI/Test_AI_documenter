package model;
import java.util.ArrayList;
import java.util.List;
public class Party {
    private static int nextId = 1;
    private int partyId;
    private String partyNumber;
    private String partyName;
    private String partyType;
    private String partyGroup;
    private String partyStatus;
    private List<Address> addresses;
    private List<Communication> communications;
    public Party(String name, String type, String group, String status) {
        this.partyId = nextId++;
        this.partyNumber = genNumber(group);
        this.partyName = name;
        this.partyType = type;
        this.partyGroup = group;
        this.partyStatus = status;
        this.addresses = new ArrayList<>();
        this.communications = new ArrayList<>();
    }
    private String genNumber(String group) {
        return group.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }
    public void addAddress(Address address) {
        if (address != null) {
            addresses.add(address);
        }
    }
    public void addCommunication(Communication communication) {
        if (communication != null) {
            communications.add(communication);
        }
    }
    @Override
    public String toString() {
        return "Party {id:" + partyId + ", number:" + partyNumber + ", name:" + partyName + ", type:" + partyType + ", group:" + partyGroup + ", status:" + partyStatus + ", addresses:" + addresses + ", communications:" + communications + "}";
    }
}