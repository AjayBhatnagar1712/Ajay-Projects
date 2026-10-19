import java.util.Scanner;
public class Taking_User_input2 {
    public static void main(String[] args) {
        System.out.println("Taking input from the user :");
        Scanner sc = new Scanner(System.in);
        System.out.println("Enter Name :");
        String name = sc.nextLine();
        System.out.println("Enter Phone Numer : ");
        long phone = sc.nextLong();
        System.out.println("Enter your Class 12th percentage :");
        float percentage = sc.nextFloat();
        System.out.println("Which statement you always follows in life true or false: ");
        boolean statement = sc.nextBoolean();
        System.out.println("Name :" + name);
        System.out.println("Phone Number :" + phone);
        System.out.println("Class 12th percentage : " + percentage);
        System.out.println("Statement which he follows in life is :" + statement);
        boolean b1 = sc.hasNextInt();
        System.out.println(b1);
    }
}