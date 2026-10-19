package JDBC;
import java.sql.*;

public class Question2 {

    public static void main(String[] args) {
        // TODO Auto-generated method stub
        try {
            // Register JDBC driver
            Class.forName("com.mysql.cj.jdbc.Driver");

            // Open a connection
            System.out.println("Connecting to database...");
            try (Connection connection = DriverManager.getConnection("jdbc:mysql://localhost:3306/Eclipse" , "root" , "AJAY@123")) {

                // Execute a query to create the  table
                System.out.println("Creating table Employee (Empl101)...");

                String createTableSQL = "CREATE TABLE IF NOT EXISTS Empl101 ("
                        + "id INT AUTO_INCREMENT PRIMARY KEY,"
                        + "first_name VARCHAR(50),"
                        + "last_name VARCHAR(50),"
                        + "age INT,"
                        + "salary DOUBLE)";

                try (Statement statement = connection.createStatement()) {
                    statement.executeUpdate(createTableSQL);
                    System.out.println("Table employee created successfully.");
                } catch (SQLException createTableException) {
                    System.err.println("Error creating table: " + createTableException.getMessage());
                }

            } catch (SQLException e) {
                // Handle errors for JDBC
                System.err.println("Connection error: " + e.getMessage());
            }

        } catch (ClassNotFoundException e) {
            // Handle errors for Class.forName
            System.err.println("JDBC Driver not found");
            e.printStackTrace();
        }

        System.out.println("Program completed.");

    }

}
