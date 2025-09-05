package model;

import java.util.ArrayList;
import java.util.List;

public class Party {
    private static int id = 1;

    private int partyId;
    private String partyNumber;
    private String partyName;
    private String partyType;
    private String partyGroup;
    private String partyStatus;

    private List<Address> addresses = new ArrayList<>();
    private List<Communication> communications = new ArrayList<>();

    public Party(String name, String type, String group, String status) {
        this.partyId = id++;
        this.partyNumber = genNumber(group);
        this.partyName = name;
        this.partyType = type;
        this.partyGroup = group;
        this.partyStatus = status;
    }

    String genNumber(String g) {
        return g.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }

    void addAddress(Address a) {
        addresses.add(a);
    }

    void addCommunication(Communication c) {
        communications.add(c);
    }

    public String toString() {
        return new StringBuilder("Party {id:").append(partyId)
                .append(", number:").append(partyNumber)
                .append(", name:").append(partyName)
                .append(", type:").append(partyType)
                .append(", group:").append(partyGroup)
                .append(", status:").append(partyStatus)
                .append(", addresses:").append(addresses)
                .append(", communications:").append(communications)
                .append("}").toString();
    }
}