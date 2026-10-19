import java.util.Scanner;

public class elseif {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter your name :-");
        String str = sc.nextLine();
        System.out.print("Enter your age :- ");
        int age = sc.nextInt();
        if (age>56){
            System.out.println("The person is experienced");
        } else if (age>46 && age<56) {
            System.out.println("You are not much experienced");
        } else if (age>18 && age<46) {
            System.out.println("You are an adult");
        }
        else {
            System.out.println("You are unnder age");
        }
    }
}
