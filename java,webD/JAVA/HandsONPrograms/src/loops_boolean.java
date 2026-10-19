import java.util.Scanner;
public class loops_boolean {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println("Input Your boolean value");
        boolean input = sc.nextBoolean();
        int i = 3;
        while(input==true){
            System.out.println(i);
            i++;
            if (i==23){
                System.out.println("The loop ends here");
                break;
            }
        }
    }
}
